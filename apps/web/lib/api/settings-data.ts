import { prisma } from '@/lib/db';
import type { OrgIntegrations, OrgMessagingSettings, UpdateIntegrationsInput, UpdateMessagingSettingsInput } from '@ko/types';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

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
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    return normalizeMessaging(settings.messaging ?? settings);
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
    const existingSettings = (org?.settings as Record<string, unknown>) ?? {};
    const current = normalizeMessaging(existingSettings.messaging ?? existingSettings);
    const merged = mergeMessaging(current, input);

    await prisma.organisation.update({
      where: { id: orgId },
      data: {
        settings: {
          ...existingSettings,
          messaging: merged,
        },
      },
    });

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

export async function getOrgProfile(orgId: string, user: { role: string }) {
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
    };
  } catch (error) {
    if (useDevStore(error)) {
      const org = devStore.getOrg(orgId);
      return {
        orgId,
        orgName: org?.name ?? 'Development Organisation',
        plan: org?.plan ?? 'STARTER',
        role: user.role as 'ADMIN' | 'ADVISER' | 'COMPLIANCE' | 'VIEWER',
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
