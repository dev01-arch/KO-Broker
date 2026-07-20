import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { upsertFactFindWithCompliance } from '@/lib/api/fact-find-data';
import { serializeFactFind } from '@/lib/api/cases';
import {
  createMessageForOrg,
  type MessageDeliveryMeta,
} from '@/lib/api/messages-data';
import { getOrgMessagingSettings } from '@/lib/api/settings-data';
import { logAuditEvent } from '@/lib/compliance/audit';
import {
  hashPortalPassword,
  signPortalSession,
  verifyPortalPassword,
  type PortalSessionPayload,
} from '@/lib/api/portal-session';
import { sendEmail } from '@/lib/notifications/email';
import { scheduleMessageEmailDigest } from '@/lib/notifications/message-email-digest';
import { sendSMS } from '@/lib/notifications/sms';
import { verifyPassword } from '@/lib/auth/portalAuth';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

function clientPortalUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'http://localhost:3002').replace(
    /\/$/,
    '',
  );
  return `${base}/invite?token=${encodeURIComponent(token)}`;
}

const PORTAL_ADVISER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

type PortalAdviserRecord = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

function formatAdviserName(firstName?: string | null, lastName?: string | null): string {
  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return name || 'Your Mortgage Adviser';
}

function serializePortalAdviser(
  adviser: PortalAdviserRecord | null,
  options?: { includeProfileFields?: boolean },
) {
  if (!adviser) {
    const placeholder = {
      name: 'Your Mortgage Adviser',
      firstName: 'Your',
      lastName: 'Adviser',
      email: '',
      phone: null as string | null,
    };

    if (options?.includeProfileFields) {
      return {
        ...placeholder,
        initials: 'KA',
        title: 'Your Mortgage Advisor',
      };
    }

    return placeholder;
  }

  const name = formatAdviserName(adviser.firstName, adviser.lastName);
  const firstName = adviser.firstName ?? '';
  const lastName = adviser.lastName ?? '';
  const initials =
    `${adviser.firstName?.[0] ?? ''}${adviser.lastName?.[0] ?? ''}`.toUpperCase() || 'KA';

  const base = {
    name,
    firstName,
    lastName,
    email: adviser.email,
    phone: null as string | null,
  };

  if (options?.includeProfileFields) {
    return {
      ...base,
      initials,
      title: 'Your Mortgage Advisor',
    };
  }

  return base;
}

async function backfillCaseAdviser(caseId: string, adviserId: string) {
  try {
    await prisma.case.update({
      where: { id: caseId },
      data: { assignedAdviserId: adviserId },
    });
  } catch {
    // Non-fatal — portal can still show the resolved adviser name.
  }
}

async function resolvePortalAdviser(
  orgId: string,
  caseId: string,
  clientId: string,
  assignedAdviser?: PortalAdviserRecord | null,
): Promise<PortalAdviserRecord | null> {
  if (assignedAdviser) return assignedAdviser;

  const siblingCase = await prisma.case.findFirst({
    where: { orgId, clientId, assignedAdviserId: { not: null }, NOT: { id: caseId } },
    orderBy: { updatedAt: 'desc' },
    include: { adviser: { select: PORTAL_ADVISER_SELECT } },
  });
  if (siblingCase?.adviser) {
    await backfillCaseAdviser(caseId, siblingCase.adviser.id);
    return siblingCase.adviser;
  }

  const inviteAudit = await prisma.auditLog.findFirst({
    where: {
      orgId,
      entityType: 'Client',
      entityId: clientId,
      action: 'PORTAL_INVITED',
      userId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (inviteAudit?.userId) {
    const invitingUser = await prisma.user.findFirst({
      where: { id: inviteAudit.userId, orgId, isActive: true },
      select: PORTAL_ADVISER_SELECT,
    });
    if (invitingUser) {
      await backfillCaseAdviser(caseId, invitingUser.id);
      return invitingUser;
    }
  }

  const orgAdvisers = await prisma.user.findMany({
    where: { orgId, isActive: true, role: { in: ['ADVISER', 'ADMIN'] } },
    select: PORTAL_ADVISER_SELECT,
    orderBy: { createdAt: 'asc' },
    take: 2,
  });

  if (orgAdvisers.length === 1) {
    await backfillCaseAdviser(caseId, orgAdvisers[0].id);
    return orgAdvisers[0];
  }

  return null;
}

function buildInitialFactFind(
  client: {
    title?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    dateOfBirth?: Date | null;
    niNumber?: string | null;
    employmentStatus: string;
    annualIncome?: number | null;
    address?: unknown;
  },
  caseRecord?: {
    propertyValue?: number | null;
    loanAmount?: number | null;
    termYears?: number | null;
  },
) {
  return {
    personalDetails: {
      title: client.title ?? '',
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone ?? '',
      dateOfBirth: client.dateOfBirth?.toISOString().slice(0, 10) ?? '',
      niNumber: client.niNumber ?? '',
      address: client.address ?? {},
    },
    employmentDetails: {
      employmentStatus: client.employmentStatus,
    },
    incomeDetails: {
      annualIncome: client.annualIncome ?? 0,
    },
    propertyDetails: {
      propertyValue: caseRecord?.propertyValue ?? 0,
      loanAmount: caseRecord?.loanAmount ?? 0,
      termYears: caseRecord?.termYears ?? 0,
    },
    expenditureDetails: {},
    existingMortgages: {},
    clientPreferences: {},
  };
}

export async function inviteClientToPortal(orgId: string, caseId: string, invitingUserId: string) {
  try {
    let caseRecord = await prisma.case.findFirst({
      where: { id: caseId, orgId },
      include: {
        client: true,
        adviser: { select: PORTAL_ADVISER_SELECT },
      },
    });

    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    if (!caseRecord.assignedAdviserId) {
      await prisma.case.update({
        where: { id: caseId },
        data: { assignedAdviserId: invitingUserId },
      });

      caseRecord = {
        ...caseRecord,
        assignedAdviserId: invitingUserId,
        adviser:
          caseRecord.adviser ??
          (await prisma.user.findFirst({
            where: { id: invitingUserId, orgId },
            select: PORTAL_ADVISER_SELECT,
          })),
      };
    }

    const token = randomUUID();
    const inviteUrl = clientPortalUrl(token);

    await prisma.client.update({
      where: { id: caseRecord.clientId },
      data: {
        portalEnabled: true,
        portalAccessToken: token,
        portalPasswordHash: null,
      },
    });

    await upsertFactFindWithCompliance(orgId, caseId, buildInitialFactFind(caseRecord.client, caseRecord), {
      allowWhenComplete: true,
    });

    await logAuditEvent({
      orgId,
      userId: invitingUserId,
      entityType: 'Client',
      entityId: caseRecord.clientId,
      action: 'PORTAL_INVITED',
      diff: {
        after: {
          portalEnabled: true,
          hasAccessToken: true,
          caseId,
          assignedAdviserId: caseRecord.assignedAdviserId ?? invitingUserId,
        },
      },
    });

    const clientName = `${caseRecord.client.firstName} ${caseRecord.client.lastName}`.trim();
    const adviserName = formatAdviserName(caseRecord.adviser?.firstName, caseRecord.adviser?.lastName);

    const emailBody = [
      `Hi ${clientName},`,
      '',
      `${adviserName} has invited you to complete your mortgage fact-find for case ${caseRecord.referenceNumber}.`,
      '',
      `Open your secure client portal to get started:`,
      inviteUrl,
      '',
      'This link is single-use. If it expires, ask your adviser to send a new invitation.',
    ].join('\n');

    const emailHtml = `
      <p>Hi ${clientName},</p>
      <p><strong>${adviserName}</strong> has invited you to complete your mortgage fact-find for case <strong>${caseRecord.referenceNumber}</strong>.</p>
      <p><a href="${inviteUrl}" style="color:#0F6E56; font-weight:600;">Open your secure client portal</a> to get started.</p>
      <p>This link is single-use. If it expires, ask your adviser to send a new invitation.</p>
    `;

    const smsBody = `KO Brokers: ${adviserName} invited you to complete your fact-find. Open: ${inviteUrl}`;

    const emailResult = await sendEmail({
      to: caseRecord.client.email,
      subject: `Complete your fact-find — ${caseRecord.referenceNumber}`,
      body: emailBody,
      html: emailHtml,
    });

    let smsResult: { ok: boolean; error?: string } = { ok: false, error: 'No phone number' };
    if (caseRecord.client.phone) {
      smsResult = await sendSMS({ to: caseRecord.client.phone, body: smsBody });
    }

    return {
      inviteUrl,
      notifications: {
        email: emailResult.ok ? 'sent' : 'failed',
        sms: smsResult.ok ? 'sent' : 'skipped',
      },
      emailError: emailResult.ok ? undefined : emailResult.error,
    };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    const caseRecord = devStore.getCase(orgId, caseId);
    if (!caseRecord) return { error: 'NOT_FOUND' as const };
    const client = devStore.getClient(orgId, caseRecord.clientId);
    if (!client) return { error: 'NOT_FOUND' as const };

    const token = randomUUID();
    devStore.updateClient(orgId, client.id, {
      portalEnabled: true,
      portalAccessToken: token,
    });

    return {
      inviteUrl: clientPortalUrl(token),
      notifications: { email: 'skipped', sms: 'skipped' },
    };
  }
}

export async function verifyPortalToken(token: string) {
  try {
    const client = await prisma.client.findFirst({
      where: { portalAccessToken: token, portalEnabled: true },
      include: {
        cases: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          include: {
            adviser: { select: PORTAL_ADVISER_SELECT },
          },
        },
      },
    });

    if (!client) return { error: 'NOT_FOUND' as const };

    const caseRecord = client.cases[0] ?? null;
    const adviser = caseRecord
      ? await resolvePortalAdviser(client.orgId, caseRecord.id, client.id, caseRecord.adviser)
      : null;

    const accountConfigured = Boolean(client.portalPasswordHash);

    return {
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
      },
      case: caseRecord
        ? {
            id: caseRecord.id,
            referenceNumber: caseRecord.referenceNumber,
            type: caseRecord.type,
            stage: caseRecord.stage,
          }
        : null,
      adviser: serializePortalAdviser(adviser),
      portalEnabled: client.portalEnabled,
      accountConfigured,
      requiresLogin: accountConfigured,
    };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return { error: 'NOT_FOUND' as const };
  }
}

export async function setupPortalAccount(token: string, password: string) {
  try {
    const client = await prisma.client.findFirst({
      where: { portalAccessToken: token, portalEnabled: true },
      include: {
        cases: { orderBy: { updatedAt: 'desc' }, take: 1, select: { id: true } },
      },
    });

    if (!client) return { error: 'NOT_FOUND' as const };

    if (client.portalPasswordHash) {
      return { error: 'ALREADY_CONFIGURED' as const };
    }

    if (!client.cases[0]) {
      return { error: 'FORBIDDEN' as const };
    }

    const passwordHash = hashPortalPassword(password);
    await prisma.client.update({
      where: { id: client.id },
      data: {
        portalPasswordHash: passwordHash,
        // Keep portalAccessToken so invite links still resolve after setup (login redirect).
      },
    });

    const session: PortalSessionPayload = {
      clientId: client.id,
      orgId: client.orgId,
      caseId: client.cases[0].id,
      email: client.email,
    };

    return { sessionToken: signPortalSession(session), session, client };
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      return { error: 'SERVICE_UNAVAILABLE' as const };
    }
    if (!useDevStore(error)) throw error;
    return { error: 'NOT_FOUND' as const };
  }
}

export async function loginPortalClient(email: string, password: string) {
  const normalizedEmail = email.trim();
  try {
    const client = await prisma.client.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        portalEnabled: true,
      },
      include: {
        cases: { orderBy: { updatedAt: 'desc' }, take: 1, select: { id: true } },
      },
    });

    if (!client) {
      return { error: 'UNAUTHORIZED' as const };
    }

    if (!client.portalPasswordHash) {
      return { error: 'SETUP_REQUIRED' as const };
    }

    if (!client.cases[0]) {
      return { error: 'FORBIDDEN' as const };
    }

    const isValid =
      verifyPortalPassword(password, client.portalPasswordHash) ||
      verifyPassword(password, client.portalPasswordHash);
    if (!isValid) {
      return { error: 'UNAUTHORIZED' as const };
    }

    const session: PortalSessionPayload = {
      clientId: client.id,
      orgId: client.orgId,
      caseId: client.cases[0].id,
      email: client.email,
    };

    return { sessionToken: signPortalSession(session), session, client };
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      return { error: 'SERVICE_UNAVAILABLE' as const };
    }
    if (!useDevStore(error)) throw error;
    return { error: 'UNAUTHORIZED' as const };
  }
}

export async function listPortalMessages(session: PortalSessionPayload) {
  try {
    const messages = await prisma.message.findMany({
      where: {
        orgId: session.orgId,
        clientId: session.clientId,
        caseId: session.caseId,
        channel: 'IN_APP',
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        direction: true,
        body: true,
        createdAt: true,
      },
    });

    return messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    }));
  } catch (error) {
    if (useDevStore(error)) {
      return devStore
        .listMessages(session.orgId, { page: 1, perPage: 100, clientId: session.clientId, caseId: session.caseId })
        .messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          createdAt: m.createdAt,
        }));
    }
    throw error;
  }
}

/** Dashboard inbox CTA for adviser notification emails (full body stays in-app). */
function adviserMessagesInboxUrl(caseId?: string, clientId?: string): string {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://ko-broker.vercel.app').replace(
    /\/$/,
    '',
  );
  const url = new URL(`${app}/dashboard/messages`);
  if (caseId) url.searchParams.set('caseId', caseId);
  if (clientId) url.searchParams.set('clientId', clientId);
  return url.toString();
}

function serializePortalMessageRow(message: {
  id: string;
  direction: string;
  body: string;
  createdAt?: Date | string;
}) {
  return {
    id: message.id,
    direction: message.direction,
    body: message.body,
    createdAt:
      message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : (message.createdAt ?? new Date().toISOString()),
  };
}

/**
 * LinkedIn-style side-notify for client → adviser replies (delayed digest).
 * Never blocks the in-app send; schedule failures are soft (delivery.email = failed|skipped).
 */
async function deliverAdviserMessageNotificationEmail(opts: {
  orgId: string;
  adviser: PortalAdviserRecord | null;
  clientFirstName?: string | null;
  body: string;
  caseId: string;
  clientId: string;
  messageId: string;
  delivery: MessageDeliveryMeta;
}): Promise<void> {
  const { adviser, delivery } = opts;

  let settings: Awaited<ReturnType<typeof getOrgMessagingSettings>>;
  try {
    settings = await getOrgMessagingSettings(opts.orgId);
  } catch {
    delivery.email = 'skipped';
    delivery.errors?.push('Could not load messaging settings');
    return;
  }

  if (settings.email?.enabled === false) {
    delivery.email = 'skipped';
    return;
  }

  if (!adviser?.email) {
    delivery.email = 'skipped';
    return;
  }

  const scheduled = await scheduleMessageEmailDigest({
    orgId: opts.orgId,
    recipientEmail: adviser.email,
    recipientName: adviser.firstName ?? undefined,
    recipientKind: 'ADVISER',
    clientId: opts.clientId,
    caseId: opts.caseId,
    firstMessageId: opts.messageId,
    previewBody: opts.body,
    subject: opts.clientFirstName?.trim()
      ? `New message from ${opts.clientFirstName.trim()}`
      : 'You have a new message on KO Broker',
    ctaUrl: adviserMessagesInboxUrl(opts.caseId, opts.clientId),
  });

  if (!scheduled.ok) {
    delivery.email = 'failed';
    delivery.errors?.push(scheduled.error);
    return;
  }

  delivery.email = 'scheduled';
}

export async function sendPortalMessage(session: PortalSessionPayload, body: string) {
  const delivery: MessageDeliveryMeta = {
    inApp: 'skipped',
    email: 'skipped',
    sms: 'skipped',
    errors: [],
  };

  let message: {
    id: string;
    direction: string;
    body: string;
    createdAt?: Date | string;
  };

  try {
    const created = await createMessageForOrg(session.orgId, {
      body,
      channel: 'IN_APP',
      direction: 'INBOUND',
      sourceType: 'CLIENT_REPLY',
      caseId: session.caseId,
      clientId: session.clientId,
    });
    message = created.message;
  } catch (error) {
    if (!useDevStore(error)) throw error;
    message = devStore.createMessage(session.orgId, {
      body,
      channel: 'IN_APP',
      direction: 'INBOUND',
      sourceType: 'CLIENT_REPLY',
      caseId: session.caseId,
      clientId: session.clientId,
    });
  }

  delivery.inApp = 'sent';

  // Soft-fail only: never block the in-app reply if adviser email cannot be sent.
  try {
    const caseRecord = await prisma.case.findFirst({
      where: {
        id: session.caseId,
        orgId: session.orgId,
        clientId: session.clientId,
      },
      include: {
        client: { select: { firstName: true } },
        adviser: { select: PORTAL_ADVISER_SELECT },
      },
    });

    const adviser = caseRecord
      ? await resolvePortalAdviser(
          session.orgId,
          session.caseId,
          session.clientId,
          caseRecord.adviser,
        )
      : await resolvePortalAdviser(session.orgId, session.caseId, session.clientId);

    await deliverAdviserMessageNotificationEmail({
      orgId: session.orgId,
      adviser,
      clientFirstName: caseRecord?.client.firstName,
      body,
      caseId: session.caseId,
      clientId: session.clientId,
      messageId: message.id,
      delivery,
    });
  } catch {
    delivery.email = 'failed';
    delivery.errors?.push('Adviser notification email could not be scheduled');
  }

  return {
    message: serializePortalMessageRow(message),
    delivery,
  };
}

export async function getPortalSessionProfile(session: PortalSessionPayload) {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: session.caseId, orgId: session.orgId, clientId: session.clientId },
      include: {
        client: { select: { firstName: true, lastName: true, email: true } },
        adviser: { select: PORTAL_ADVISER_SELECT },
      },
    });

    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const adviser = await resolvePortalAdviser(
      session.orgId,
      caseRecord.id,
      session.clientId,
      caseRecord.adviser,
    );

    return {
      client: caseRecord.client,
      adviser: serializePortalAdviser(adviser, { includeProfileFields: true }),
      case: {
        id: caseRecord.id,
        referenceNumber: caseRecord.referenceNumber,
        stage: caseRecord.stage,
        clientStageLabel: caseRecord.stage.replace(/_/g, ' '),
        type: caseRecord.type,
      },
      tasks: [],
      progressSteps: [],
    };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return { error: 'NOT_FOUND' as const };
  }
}

export async function getPortalFactFind(session: PortalSessionPayload) {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: session.caseId, orgId: session.orgId, clientId: session.clientId },
      include: { factFind: true },
    });
    if (!caseRecord) return { error: 'NOT_FOUND' as const };
    if (!caseRecord.factFind) return null;
    return serializeFactFind(caseRecord.factFind);
  } catch (error) {
    if (!useDevStore(error)) throw error;
    const caseRecord = devStore.getCase(session.orgId, session.caseId);
    if (!caseRecord || caseRecord.client.id !== session.clientId) return { error: 'NOT_FOUND' as const };
    return caseRecord.factFind ? serializeFactFind(caseRecord.factFind) : null;
  }
}

export async function updatePortalFactFind(
  session: PortalSessionPayload,
  input: {
    personalDetails?: Record<string, unknown>;
    employmentDetails?: Record<string, unknown>;
    incomeDetails?: Record<string, unknown>;
    expenditureDetails?: Record<string, unknown>;
    propertyDetails?: Record<string, unknown>;
    existingMortgages?: Record<string, unknown>;
    clientPreferences?: Record<string, unknown>;
    markComplete?: boolean;
  },
) {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: session.caseId, orgId: session.orgId, clientId: session.clientId },
      select: { id: true },
    });
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const result = await upsertFactFindWithCompliance(session.orgId, session.caseId, input, {
      allowWhenComplete: false,
    });
    if ('error' in result) {
      if (result.error === 'FORBIDDEN') {
        return { error: 'FORBIDDEN' as const, message: result.message };
      }
      return { error: 'NOT_FOUND' as const };
    }
    return serializeFactFind(result.factFind);
  } catch (error) {
    if (!useDevStore(error)) throw error;
    const caseRecord = devStore.getCase(session.orgId, session.caseId);
    if (!caseRecord || caseRecord.client.id !== session.clientId) return { error: 'NOT_FOUND' as const };
    const result = devStore.upsertFactFind(session.orgId, session.caseId, input);
    if ('error' in result) return { error: 'NOT_FOUND' as const };
    return serializeFactFind(result.factFind);
  }
}
