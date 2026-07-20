import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { getOrgIntegrations, getOrgMessagingSettings } from '@/lib/api/settings-data';
import { clientAllowsMessageEmails } from '@/lib/api/client-notification-prefs';
import {
  cancelPendingDigestsIfCaughtUp,
  scheduleMessageEmailDigest,
} from '@/lib/notifications/message-email-digest';
import { sendSMS } from '@/lib/notifications/sms';
import type { MessageChannel, MessageDirection, MessageSource } from '@ko/types';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

/** Deep-link target for “view message” CTAs (full content stays in-app). */
function messageInboxUrl(): string {
  const portal = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL?.trim().replace(/\/$/, '');
  if (portal) return portal;
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://ko-broker.vercel.app').replace(/\/$/, '');
}

/**
 * LinkedIn-style notification email (preview only, delayed + batched).
 * Schedules a digest: first message preview is locked; later messages do not re-email.
 */
async function deliverMessageNotificationEmail(opts: {
  orgId: string;
  settings: Awaited<ReturnType<typeof getOrgMessagingSettings>>;
  client: ClientContact | null;
  body: string;
  subject?: string;
  messageId: string;
  caseId?: string;
  delivery: MessageDeliveryMeta;
  /** EMAIL channel: missing recipient is an error. IN_APP notify: skip quietly if no client. */
  requireRecipient: boolean;
}): Promise<void> {
  const { settings, client, delivery, requireRecipient } = opts;

  if (settings.email?.enabled === false) {
    delivery.email = 'skipped';
    if (requireRecipient) {
      delivery.errors?.push('Email channel is disabled in Settings');
    }
    return;
  }

  if (!client?.email) {
    if (requireRecipient || client) {
      delivery.email = 'failed';
      delivery.errors?.push(
        client
          ? 'Client email address is missing'
          : 'Client email address is missing — add a Client ID to send the notification email',
      );
    }
    return;
  }

  // Personal opt-out (AND with org messaging.email.enabled above).
  try {
    const allowsEmail = await clientAllowsMessageEmails(client.id, opts.orgId);
    if (!allowsEmail) {
      delivery.email = 'skipped';
      return;
    }
  } catch (error) {
    console.error('[messages] client notification prefs check failed:', error);
    // Fail soft — still try to schedule so in-app send delivery meta stays useful.
  }

  const scheduled = await scheduleMessageEmailDigest({
    orgId: opts.orgId,
    recipientEmail: client.email,
    recipientName: client.firstName,
    recipientKind: 'CLIENT',
    clientId: client.id,
    caseId: opts.caseId,
    firstMessageId: opts.messageId,
    previewBody: opts.body,
    subject: opts.subject,
    ctaUrl: messageInboxUrl(),
  });

  if (!scheduled.ok) {
    delivery.email = 'failed';
    delivery.errors?.push(scheduled.error);
    return;
  }

  delivery.email = 'scheduled';
}

type ClientContact = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
};

export type MessageDeliveryMeta = {
  inApp: 'sent' | 'skipped';
  email: 'sent' | 'skipped' | 'failed' | 'scheduled';
  sms: 'sent' | 'skipped' | 'failed';
  errors?: string[];
};

export async function listMessagesForOrg(
  orgId: string,
  params: {
    page: number;
    perPage: number;
    caseId?: string;
    clientId?: string;
    unreadOnly?: boolean;
  },
) {
  try {
    const where = {
      orgId,
      ...(params.caseId ? { caseId: params.caseId } : {}),
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.unreadOnly ? { isRead: false } : {}),
    };
    const [total, messages] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
        include: {
          case: { select: { id: true, referenceNumber: true } },
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    return { total, messages };
  } catch (error) {
    if (useDevStore(error)) return devStore.listMessages(orgId, params);
    throw error;
  }
}

async function resolveClientContact(
  orgId: string,
  caseId?: string,
  clientId?: string,
): Promise<ClientContact | null> {
  try {
    if (clientId) {
      return prisma.client.findFirst({
        where: { id: clientId, orgId },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true },
      });
    }
    if (caseId) {
      const caseRecord = await prisma.case.findFirst({
        where: { id: caseId, orgId },
        include: {
          client: {
            select: { id: true, email: true, phone: true, firstName: true, lastName: true },
          },
        },
      });
      return caseRecord?.client ?? null;
    }
    return null;
  } catch (error) {
    if (useDevStore(error)) {
      if (clientId) {
        const client = devStore.getClient(orgId, clientId);
        if (!client) return null;
        return {
          id: client.id,
          email: client.email,
          phone: client.phone ?? null,
          firstName: client.firstName,
          lastName: client.lastName,
        };
      }
      if (caseId) {
        const caseRecord = devStore.getCase(orgId, caseId);
        if (!caseRecord) return null;
        const client = devStore.getClient(orgId, caseRecord.clientId);
        if (!client) return null;
        return {
          id: client.id,
          email: client.email,
          phone: client.phone ?? null,
          firstName: client.firstName,
          lastName: client.lastName,
        };
      }
    }
    throw error;
  }
}

export async function createMessageForOrg(
  orgId: string,
  input: {
    body: string;
    channel: MessageChannel;
    direction: MessageDirection;
    sourceType: MessageSource;
    subject?: string;
    caseId?: string;
    clientId?: string;
    threadId?: string;
  },
) {
  try {
    const message = await prisma.message.create({
      data: { orgId, ...input },
      include: {
        case: { select: { id: true, referenceNumber: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return { message };
  } catch (error) {
    if (useDevStore(error)) return { message: devStore.createMessage(orgId, input) };
    throw error;
  }
}

function enabledChannels(settings: Awaited<ReturnType<typeof getOrgMessagingSettings>>): MessageChannel[] {
  const channels: MessageChannel[] = [];
  if (settings.inApp?.enabled !== false) channels.push('IN_APP');
  if (settings.email?.enabled !== false) channels.push('EMAIL');
  if (settings.sms?.enabled !== false) channels.push('SMS');
  return channels.length ? channels : ['IN_APP'];
}

export async function broadcastMessageForOrg(
  orgId: string,
  input: {
    body: string;
    direction: MessageDirection;
    sourceType: MessageSource;
    subject?: string;
    caseId?: string;
    clientId?: string;
  },
) {
  const settings = await getOrgMessagingSettings(orgId);
  const integrations = await getOrgIntegrations(orgId);
  const channels = enabledChannels(settings);
  const client = await resolveClientContact(orgId, input.caseId, input.clientId);
  const resolvedClientId = input.clientId ?? client?.id;
  const threadId = randomUUID();
  const delivery: MessageDeliveryMeta = {
    inApp: 'skipped',
    email: 'skipped',
    sms: 'skipped',
    errors: [],
  };

  const messages = [];
  for (const channel of channels) {
    const { message } = await createMessageForOrg(orgId, {
      ...input,
      channel,
      clientId: resolvedClientId,
      threadId,
    });
    messages.push(message);
    if (channel === 'IN_APP') delivery.inApp = 'sent';
  }

  if (channels.includes('EMAIL') || channels.includes('IN_APP')) {
    const primaryForNotify =
      messages.find((m) => m.channel === 'IN_APP') ??
      messages.find((m) => m.channel === 'EMAIL') ??
      messages[0];
    if (primaryForNotify) {
      await deliverMessageNotificationEmail({
        orgId,
        settings,
        client,
        body: input.body,
        subject: input.subject,
        messageId: primaryForNotify.id,
        caseId: input.caseId,
        delivery,
        requireRecipient: channels.includes('EMAIL') && !channels.includes('IN_APP'),
      });
    }
  }

  if (channels.includes('SMS')) {
    if (integrations.twilio?.enabled === false) {
      delivery.sms = 'failed';
      delivery.errors?.push('Twilio integration is disabled in Settings');
    } else if (!client?.phone) {
      delivery.sms = 'failed';
      delivery.errors?.push('Client phone number is missing');
    } else {
      const result = await sendSMS({ to: client.phone, body: input.body });
      delivery.sms = result.ok ? 'sent' : 'failed';
      if (!result.ok) delivery.errors?.push(result.error);
    }
  }

  const primary =
    messages.find((m) => m.channel === 'IN_APP') ??
    messages.find((m) => m.channel === 'EMAIL') ??
    messages[0];

  return { messages, primary, delivery };
}

export async function markMessageReadForOrg(orgId: string, id: string, isRead = true) {
  try {
    const existing = await prisma.message.findFirst({ where: { id, orgId } });
    if (!existing) return null;
    const updated = await prisma.message.update({ where: { id }, data: { isRead } });
    if (isRead) {
      await cancelPendingDigestsIfCaughtUp({
        orgId,
        clientId: existing.clientId,
        caseId: existing.caseId,
      });
    }
    return updated;
  } catch (error) {
    if (useDevStore(error)) return devStore.markMessageRead(orgId, id, isRead);
    throw error;
  }
}

/** Sends via a single selected channel (§10 Messages API). */
export async function sendMessageForOrg(
  orgId: string,
  input: {
    body: string;
    channel: MessageChannel;
    sourceType: MessageSource;
    subject?: string;
    caseId?: string;
    clientId?: string;
  },
) {
  const settings = await getOrgMessagingSettings(orgId);
  const integrations = await getOrgIntegrations(orgId);
  const client = await resolveClientContact(orgId, input.caseId, input.clientId);
  const resolvedClientId = input.clientId ?? client?.id;
  const threadId = randomUUID();
  const delivery: MessageDeliveryMeta = {
    inApp: 'skipped',
    email: 'skipped',
    sms: 'skipped',
    errors: [],
  };

  const { message } = await createMessageForOrg(orgId, {
    body: input.body,
    channel: input.channel,
    direction: input.sourceType === 'CLIENT_REPLY' ? 'INBOUND' : 'OUTBOUND',
    sourceType: input.sourceType,
    subject: input.subject,
    caseId: input.caseId,
    clientId: resolvedClientId,
    threadId,
  });

  if (input.channel === 'IN_APP') {
    if (settings.inApp?.enabled === false) {
      delivery.inApp = 'skipped';
      delivery.errors?.push('In-app channel is disabled in Settings');
    } else {
      delivery.inApp = 'sent';
      // Side-notify by delayed digest email (LinkedIn-style: first preview only).
      await deliverMessageNotificationEmail({
        orgId,
        settings,
        client,
        body: input.body,
        subject: input.subject,
        messageId: message.id,
        caseId: input.caseId,
        delivery,
        requireRecipient: false,
      });
    }
  }

  if (input.channel === 'EMAIL') {
    if (settings.email?.enabled === false) {
      delivery.email = 'skipped';
      delivery.errors?.push('Email notifications are disabled in Settings');
    } else {
      await deliverMessageNotificationEmail({
        orgId,
        settings,
        client,
        body: input.body,
        subject: input.subject,
        messageId: message.id,
        caseId: input.caseId,
        delivery,
        requireRecipient: true,
      });
    }
  }

  if (input.channel === 'SMS') {
    if (settings.sms?.enabled === false) {
      delivery.sms = 'skipped';
      delivery.errors?.push('SMS channel is disabled in Settings');
    } else if (integrations.twilio?.enabled === false) {
      delivery.sms = 'failed';
      delivery.errors?.push('Twilio integration is disabled in Settings');
    } else if (!client?.phone) {
      delivery.sms = 'failed';
      delivery.errors?.push('Client phone number is missing');
    } else {
      const result = await sendSMS({ to: client.phone, body: input.body });
      delivery.sms = result.ok ? 'sent' : 'failed';
      if (!result.ok) delivery.errors?.push(result.error);
    }
  }

  return { primary: message, delivery };
}
