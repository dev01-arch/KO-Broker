import { prisma } from '@/lib/db';
import { Prisma } from '@ko/db';
import type { OrgIntegrations, OrgMessagingSettings, UpdateIntegrationsInput, UpdateMessagingSettingsInput } from '@ko/types';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { cancelAllPendingDigestsForOrg } from '@/lib/notifications/message-email-digest';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

function normalizeIntegrations(raw: unknown): OrgIntegrations {
  const source = (raw as Record<string, unknown>) ?? {};
  const nested = (source.integrations as Record<string, unknown> | undefined) ?? source;

  const equifaxRaw = nested.equifax as Record<string, unknown> | undefined;
  const twilioRaw = nested.twilio as Record<string, unknown> | undefined;

  if (equifaxRaw || twilioRaw) {
    return {
      equifax: {
        apiKey: typeof equifaxRaw?.apiKey === 'string' ? equifaxRaw.apiKey : undefined,
        enabled: Boolean(equifaxRaw?.enabled),
      },
      twilio: {
        accountSid: typeof twilioRaw?.accountSid === 'string' ? twilioRaw.accountSid : undefined,
        authToken: typeof twilioRaw?.authToken === 'string' ? twilioRaw.authToken : undefined,
        enabled: Boolean(twilioRaw?.enabled),
      },
    };
  }

  const legacyTwilioSid =
    typeof nested.twilioAccountSid === 'string' ? nested.twilioAccountSid : undefined;
  const legacyTwilioToken =
    typeof nested.twilioAuthToken === 'string' ? nested.twilioAuthToken : undefined;

  return {
    equifax: { enabled: false },
    twilio: {
      accountSid: legacyTwilioSid,
      authToken: legacyTwilioToken,
      enabled: Boolean(legacyTwilioSid || legacyTwilioToken),
    },
  };
}

function isMaskedSecret(value: string | undefined): boolean {
  return Boolean(value && value.includes('•'));
}

function mergeEquifax(
  current: { apiKey?: string; enabled: boolean },
  incoming?: { apiKey?: string; enabled?: boolean },
) {
  const next = {
    apiKey: current.apiKey,
    enabled: incoming?.enabled ?? current.enabled,
  };
  if (typeof incoming?.apiKey === 'string' && !isMaskedSecret(incoming.apiKey)) {
    next.apiKey = incoming.apiKey;
  }
  return next;
}

function mergeTwilio(
  current: { accountSid?: string; authToken?: string; enabled: boolean },
  incoming?: { accountSid?: string; authToken?: string; enabled?: boolean },
) {
  const next = {
    accountSid: incoming?.accountSid ?? current.accountSid,
    authToken: current.authToken,
    enabled: incoming?.enabled ?? current.enabled,
  };
  if (typeof incoming?.authToken === 'string' && !isMaskedSecret(incoming.authToken)) {
    next.authToken = incoming.authToken;
  }
  return next;
}

const DEFAULT_MESSAGING: Required<OrgMessagingSettings> = {
  inApp: { enabled: true },
  email: { enabled: true },
  sms: { enabled: true },
};

function normalizeMessaging(raw: unknown): OrgMessagingSettings {
  const source = (raw as Record<string, unknown>) ?? {};
  const nested = (source.messaging as Record<string, unknown> | undefined) ?? source;
  const inApp = nested.inApp as { enabled?: boolean } | undefined;
  const email = nested.email as { enabled?: boolean } | undefined;
  const sms = nested.sms as { enabled?: boolean } | undefined;

  return {
    inApp: { enabled: inApp?.enabled ?? DEFAULT_MESSAGING.inApp.enabled },
    email: { enabled: email?.enabled ?? DEFAULT_MESSAGING.email.enabled },
    sms: { enabled: sms?.enabled ?? DEFAULT_MESSAGING.sms.enabled },
  };
}

function mergeMessaging(
  current: OrgMessagingSettings,
  incoming?: UpdateMessagingSettingsInput,
): OrgMessagingSettings {
  return {
    inApp: { enabled: incoming?.inApp?.enabled ?? current.inApp?.enabled ?? true },
    email: { enabled: incoming?.email?.enabled ?? current.email?.enabled ?? true },
    sms: { enabled: incoming?.sms?.enabled ?? current.sms?.enabled ?? true },
  };
}

export async function getOrgIntegrations(orgId: string): Promise<OrgIntegrations> {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    return normalizeIntegrations(settings.integrations ?? settings);
  } catch (error) {
    if (useDevStore(error)) {
      return normalizeIntegrations(devStore.getOrgSettings(orgId));
    }
    throw error;
  }
}

export async function updateOrgIntegrations(
  orgId: string,
  input: UpdateIntegrationsInput,
): Promise<OrgIntegrations> {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const existingSettings = (org?.settings as Record<string, unknown>) ?? {};
    const current = normalizeIntegrations(existingSettings.integrations ?? existingSettings);

    const merged: OrgIntegrations = {
      equifax: mergeEquifax(
        { apiKey: current.equifax?.apiKey, enabled: current.equifax?.enabled ?? false },
        input.equifax,
      ),
      twilio: mergeTwilio(
        {
          accountSid: current.twilio?.accountSid,
          authToken: current.twilio?.authToken,
          enabled: current.twilio?.enabled ?? false,
        },
        input.twilio,
      ),
    };

    await prisma.organisation.update({
      where: { id: orgId },
      data: {
        settings: {
          ...existingSettings,
          integrations: merged,
        },
      },
    });

    return merged;
  } catch (error) {
    if (useDevStore(error)) {
      const current = normalizeIntegrations(devStore.getOrgSettings(orgId));
      const merged: OrgIntegrations = {
        equifax: mergeEquifax(
          { apiKey: current.equifax?.apiKey, enabled: current.equifax?.enabled ?? false },
          input.equifax,
        ),
        twilio: mergeTwilio(
          {
            accountSid: current.twilio?.accountSid,
            authToken: current.twilio?.authToken,
            enabled: current.twilio?.enabled ?? false,
          },
          input.twilio,
        ),
      };
      devStore.updateOrgSettings(orgId, { integrations: merged });
      return merged;
    }
    throw error;
  }
}

export async function getOrgMessagingSettings(orgId: string): Promise<OrgMessagingSettings> {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const settings =
      org?.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    return normalizeMessaging(settings.messaging ?? {});
  } catch (error) {
    if (useDevStore(error)) {
      const devSettings = devStore.getOrgSettings(orgId);
      return normalizeMessaging(devSettings.messaging ?? {});
    }
    throw error;
  }
}

export async function updateOrgMessagingSettings(
  orgId: string,
  input: UpdateMessagingSettingsInput,
): Promise<OrgMessagingSettings> {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const existingSettings =
      org?.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
        ? ({ ...(org.settings as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const current = normalizeMessaging(existingSettings.messaging ?? {});
    const merged = mergeMessaging(current, input);

    await prisma.organisation.update({
      where: { id: orgId },
      data: {
        settings: {
          ...existingSettings,
          messaging: merged,
        } as Prisma.InputJsonValue,
      },
    });

    // Turning off email notifications cancels any LinkedIn-style digests waiting to send.
    if (merged.email?.enabled === false) {
      await cancelAllPendingDigestsForOrg(orgId);
    }

    return merged;
  } catch (error) {
    if (useDevStore(error)) {
      const current = normalizeMessaging(devStore.getOrgSettings(orgId).messaging ?? {});
      const merged = mergeMessaging(current, input);
      devStore.updateOrgSettings(orgId, { messaging: merged });
      return merged;
    }
    throw error;
  }
}

export async function getOrgProfile(
  orgId: string,
  user: {
    role: string;
    canViewAllClients?: boolean;
    canViewAccountDetails?: boolean;
    canViewAiSummaries?: boolean;
  },
) {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, plan: true },
    });
    if (!org) return null;
    return {
      orgId: org.id,
      orgName: org.name,
      plan: org.plan as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE',
      role: user.role as 'ADMIN' | 'ADVISER' | 'COMPLIANCE' | 'VIEWER',
      // Per-adviser visibility (ADMIN UI ignores these; advisers use for nav/gates)
      canViewAllClients: user.role === 'ADMIN' ? true : Boolean(user.canViewAllClients),
      canViewAccountDetails: user.role === 'ADMIN' ? true : Boolean(user.canViewAccountDetails),
      canViewAiSummaries: user.role === 'ADMIN' ? true : Boolean(user.canViewAiSummaries),
    };
  } catch (error) {
    if (useDevStore(error)) {
      const org = devStore.getOrg(orgId);
      return {
        orgId,
        orgName: org?.name ?? 'Development Organisation',
        plan: org?.plan ?? 'STARTER',
        role: user.role as 'ADMIN' | 'ADVISER' | 'COMPLIANCE' | 'VIEWER',
        canViewAllClients: user.role === 'ADMIN' ? true : Boolean(user.canViewAllClients),
        canViewAccountDetails: user.role === 'ADMIN' ? true : Boolean(user.canViewAccountDetails),
        canViewAiSummaries: user.role === 'ADMIN' ? true : Boolean(user.canViewAiSummaries),
      };
    }
    throw error;
  }
}

export async function listAdvisersForOrg(orgId: string) {
  try {
    return await prisma.organisationMember.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (useDevStore(error)) {
      return devStore.listAdvisers(orgId);
    }
    throw error;
  }
}

const SETTINGS_ADVISER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  invitePending: true,
  inviteTokenExpiry: true,
  canViewAllClients: true,
  canViewAccountDetails: true,
  canViewAiSummaries: true,
  createdAt: true,
  organisationMember: { select: { id: true } },
} as const;

/**
 * Advisers for settings UI + assignment: User rows that were invited
 * (pending invite or linked OrganisationMember). Excludes Clerk-only
 * users who were never invited via Add adviser.
 */
export async function listInvitedAdvisersForOrg(orgId: string) {
  try {
    const advisers = await prisma.user.findMany({
      where: {
        orgId,
        role: { not: 'ADMIN' },
        OR: [{ invitePending: true }, { organisationMember: { isNot: null } }],
      },
      select: SETTINGS_ADVISER_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return advisers.map(({ organisationMember, ...adviser }) => ({
      ...adviser,
      memberId: organisationMember?.id ?? null,
    }));
  } catch (error) {
    if (useDevStore(error)) {
      return devStore.listAdvisers(orgId).map((member) => ({
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        role: member.role,
        isActive: member.isActive,
        invitePending: false,
        inviteTokenExpiry: null as string | null,
        canViewAllClients: false,
        canViewAccountDetails: false,
        canViewAiSummaries: false,
        createdAt: member.createdAt,
        memberId: member.id,
      }));
    }
    throw error;
  }
}

export async function createAdviserForOrg(
  orgId: string,
  input: { firstName: string; lastName: string; email: string },
) {
  try {
    return await prisma.organisationMember.create({
      data: {
        orgId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        role: 'ADVISER',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (useDevStore(error)) {
      return devStore.createAdviser(orgId, input);
    }
    throw error;
  }
}
