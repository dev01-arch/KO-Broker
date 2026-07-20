import { Prisma } from '@ko/db';
import { prisma } from '@/lib/db';
import { getOrgMessagingSettings } from '@/lib/api/settings-data';
import { cancelPendingMessageEmailDigestsForRecipient } from '@/lib/notifications/message-email-digest';
import type { PortalSessionPayload } from '@/lib/api/portal-session';

export type ClientNotificationPrefs = {
  /** Personal opt-in for LinkedIn-style message digest emails. Default ON. */
  emailMessages: boolean;
  /**
   * Personal preference for in-app message alerts (bell).
   * Does not remove the message thread — full messages stay available.
   * Default ON.
   */
  inAppMessages: boolean;
};

export type PortalNotificationSettings = ClientNotificationPrefs & {
  orgEmailEnabled: boolean;
  orgInAppEnabled: boolean;
  orgSmsEnabled: boolean;
};

type ClientPrefsRow = {
  id: string;
  notificationPrefs: unknown;
};

export function normalizeClientNotificationPrefs(raw: unknown): ClientNotificationPrefs {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    emailMessages: source.emailMessages !== false,
    inAppMessages: source.inAppMessages !== false,
  };
}

async function findClientPrefsRow(
  clientId: string,
  orgId: string,
): Promise<ClientPrefsRow | null> {
  // Cast keeps this compiling before/after prisma generate picks up notificationPrefs.
  const client = (await prisma.client.findFirst({
    where: { id: clientId, orgId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- field may precede generate
    select: { id: true, notificationPrefs: true } as any,
  })) as ClientPrefsRow | null;
  return client;
}

export async function getClientNotificationPrefs(
  clientId: string,
  orgId: string,
): Promise<ClientNotificationPrefs> {
  const client = await findClientPrefsRow(clientId, orgId);
  return normalizeClientNotificationPrefs(client?.notificationPrefs);
}

export async function clientAllowsMessageEmails(
  clientId: string,
  orgId: string,
): Promise<boolean> {
  const prefs = await getClientNotificationPrefs(clientId, orgId);
  return prefs.emailMessages;
}

export async function getPortalNotificationSettings(
  session: PortalSessionPayload,
): Promise<PortalNotificationSettings> {
  const [client, messaging] = await Promise.all([
    findClientPrefsRow(session.clientId, session.orgId),
    getOrgMessagingSettings(session.orgId),
  ]);

  if (!client) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  const prefs = normalizeClientNotificationPrefs(client.notificationPrefs);
  return {
    ...prefs,
    orgEmailEnabled: messaging.email?.enabled !== false,
    orgInAppEnabled: messaging.inApp?.enabled !== false,
    orgSmsEnabled: messaging.sms?.enabled !== false,
  };
}

export async function updatePortalNotificationSettings(
  session: PortalSessionPayload,
  input: { emailMessages?: boolean; inAppMessages?: boolean },
): Promise<PortalNotificationSettings> {
  const client = await findClientPrefsRow(session.clientId, session.orgId);

  if (!client) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  const current = normalizeClientNotificationPrefs(client.notificationPrefs);
  const next: ClientNotificationPrefs = {
    emailMessages:
      typeof input.emailMessages === 'boolean' ? input.emailMessages : current.emailMessages,
    inAppMessages:
      typeof input.inAppMessages === 'boolean' ? input.inAppMessages : current.inAppMessages,
  };

  await prisma.client.update({
    where: { id: client.id },
    data: {
      notificationPrefs: next,
    } as Prisma.ClientUpdateInput,
  });

  if (!next.emailMessages) {
    await cancelPendingMessageEmailDigestsForRecipient({
      orgId: session.orgId,
      recipientKind: 'CLIENT',
      clientId: session.clientId,
    });
  }

  const messaging = await getOrgMessagingSettings(session.orgId);
  return {
    ...next,
    orgEmailEnabled: messaging.email?.enabled !== false,
    orgInAppEnabled: messaging.inApp?.enabled !== false,
    orgSmsEnabled: messaging.sms?.enabled !== false,
  };
}
