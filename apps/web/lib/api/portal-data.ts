import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { upsertFactFindForCase } from '@/lib/api/cases-data';
import { serializeFactFind } from '@/lib/api/cases';
import { createMessageForOrg } from '@/lib/api/messages-data';
import {
  hashPortalPassword,
  signPortalSession,
  verifyPortalPassword,
  type PortalSessionPayload,
} from '@/lib/api/portal-session';
import { sendEmail } from '@/lib/notifications/email';
import { sendSMS } from '@/lib/notifications/sms';

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

function buildInitialFactFind(client: {
  title?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: Date | null;
  employmentStatus: string;
  annualIncome?: number | null;
  address?: unknown;
}) {
  return {
    personalDetails: {
      title: client.title ?? undefined,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone ?? undefined,
      dateOfBirth: client.dateOfBirth?.toISOString().slice(0, 10),
      address: client.address ?? undefined,
    },
    employmentDetails: {
      employmentStatus: client.employmentStatus,
    },
    incomeDetails: {
      annualIncome: client.annualIncome ?? undefined,
    },
  };
}

export async function inviteClientToPortal(orgId: string, caseId: string) {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, orgId },
      include: {
        client: true,
        adviser: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!caseRecord) return { error: 'NOT_FOUND' as const };

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

    await upsertFactFindForCase(orgId, caseId, buildInitialFactFind(caseRecord.client));

    const clientName = `${caseRecord.client.firstName} ${caseRecord.client.lastName}`.trim();
    const adviserName = caseRecord.adviser
      ? `${caseRecord.adviser.firstName ?? ''} ${caseRecord.adviser.lastName ?? ''}`.trim()
      : 'your mortgage adviser';

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

    const smsBody = `KO Brokers: ${adviserName} invited you to complete your fact-find. Open: ${inviteUrl}`;

    const emailResult = await sendEmail({
      to: caseRecord.client.email,
      subject: `Complete your fact-find — ${caseRecord.referenceNumber}`,
      body: emailBody,
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
            adviser: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!client) return { error: 'NOT_FOUND' as const };

    const caseRecord = client.cases[0] ?? null;
    const adviser = caseRecord?.adviser ?? null;

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
      adviser: adviser
        ? {
            firstName: adviser.firstName ?? '',
            lastName: adviser.lastName ?? '',
            email: adviser.email,
            phone: null,
          }
        : {
            firstName: 'Your',
            lastName: 'Adviser',
            email: '',
            phone: null,
          },
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

    const passwordHash = hashPortalPassword(password);
    await prisma.client.update({
      where: { id: client.id },
      data: {
        portalPasswordHash: passwordHash,
        portalAccessToken: null,
      },
    });

    const session: PortalSessionPayload = {
      clientId: client.id,
      orgId: client.orgId,
      caseId: client.cases[0]?.id ?? '',
      email: client.email,
    };

    return { sessionToken: signPortalSession(session), session };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return { error: 'NOT_FOUND' as const };
  }
}

export async function loginPortalClient(email: string, password: string) {
  try {
    const client = await prisma.client.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, portalEnabled: true },
      include: {
        cases: { orderBy: { updatedAt: 'desc' }, take: 1, select: { id: true } },
      },
    });

    if (!client?.portalPasswordHash || !client.cases[0]) {
      return { error: 'UNAUTHORIZED' as const };
    }

    if (!verifyPortalPassword(password, client.portalPasswordHash)) {
      return { error: 'UNAUTHORIZED' as const };
    }

    const session: PortalSessionPayload = {
      clientId: client.id,
      orgId: client.orgId,
      caseId: client.cases[0].id,
      email: client.email,
    };

    return { sessionToken: signPortalSession(session), session };
  } catch (error) {
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

export async function sendPortalMessage(session: PortalSessionPayload, body: string) {
  try {
    const { message } = await createMessageForOrg(session.orgId, {
      body,
      channel: 'IN_APP',
      direction: 'INBOUND',
      sourceType: 'CLIENT_REPLY',
      caseId: session.caseId,
      clientId: session.clientId,
    });

    return {
      id: message.id,
      direction: message.direction,
      body: message.body,
    };
  } catch (error) {
    if (useDevStore(error)) {
      const message = devStore.createMessage(session.orgId, {
        body,
        channel: 'IN_APP',
        direction: 'INBOUND',
        sourceType: 'CLIENT_REPLY',
        caseId: session.caseId,
        clientId: session.clientId,
      });
      return {
        id: message.id,
        direction: message.direction,
        body: message.body,
      };
    }
    throw error;
  }
}

export async function getPortalSessionProfile(session: PortalSessionPayload) {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: session.caseId, orgId: session.orgId, clientId: session.clientId },
      include: {
        client: { select: { firstName: true, lastName: true, email: true } },
        adviser: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const adviser = caseRecord.adviser;
    const initials = adviser
      ? `${adviser.firstName?.[0] ?? ''}${adviser.lastName?.[0] ?? ''}`.toUpperCase()
      : 'KA';

    return {
      client: caseRecord.client,
      adviser: {
        firstName: adviser?.firstName ?? 'Your',
        lastName: adviser?.lastName ?? 'Adviser',
        initials,
        phone: '',
        email: adviser?.email ?? '',
        title: 'Your Mortgage Advisor',
      },
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

    const result = await upsertFactFindForCase(session.orgId, session.caseId, input);
    if ('error' in result) return { error: 'NOT_FOUND' as const };
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
