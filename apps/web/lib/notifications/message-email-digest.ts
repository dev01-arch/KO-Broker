/**
 * LinkedIn-style delayed message notification emails.
 *
 * - Do not email immediately when a message is sent.
 * - Wait several hours (default 4h), then send at most one email.
 * - Preview is locked to the first message in the window; later messages do not change it.
 * - If the recipient has already read everything, the digest is skipped/cancelled.
 */

import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/notifications/email';
import { buildMessageNotificationEmail } from '@/lib/notifications/email-template';

export type DigestRecipientKind = 'CLIENT' | 'ADVISER';

export type ScheduleDigestInput = {
  orgId: string;
  recipientEmail: string;
  recipientName?: string;
  recipientKind: DigestRecipientKind;
  clientId?: string;
  caseId?: string;
  firstMessageId: string;
  previewBody: string;
  subject?: string;
  ctaUrl: string;
};

/**
 * Where the "Unsubscribe" link in a digest email should land, so the recipient can
 * turn off email notifications themselves (org Messaging toggle for advisers, personal
 * preference toggle for clients).
 */
function unsubscribeUrlFor(recipientKind: DigestRecipientKind): string {
  if (recipientKind === 'ADVISER') {
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://ko-broker.vercel.app').replace(
      /\/$/,
      '',
    );
    return `${appUrl}/dashboard/settings?section=messaging`;
  }

  const portalUrl = (process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'http://localhost:3002').replace(
    /\/$/,
    '',
  );
  return `${portalUrl}/settings?section=notifications`;
}

function digestDelayMs(): number {
  const explicitMs = Number(process.env.MESSAGE_EMAIL_DIGEST_DELAY_MS ?? '');
  if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs;
  const hours = Number(process.env.MESSAGE_EMAIL_DIGEST_DELAY_HOURS ?? '4');
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 4;
  return Math.round(safeHours * 60 * 60 * 1000);
}

/**
 * Enqueue (or no-op if already pending). Never overwrites the first-message preview.
 */
export async function scheduleMessageEmailDigest(
  input: ScheduleDigestInput,
): Promise<{ ok: true; digestId: string; alreadyPending: boolean } | { ok: false; error: string }> {
  try {
    const existing = await prisma.messageEmailDigest.findFirst({
      where: {
        orgId: input.orgId,
        recipientEmail: input.recipientEmail.toLowerCase(),
        recipientKind: input.recipientKind,
        status: 'PENDING',
        ...(input.clientId ? { clientId: input.clientId } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      // Later messages in the window: keep the first preview only.
      return { ok: true, digestId: existing.id, alreadyPending: true };
    }

    const digest = await prisma.messageEmailDigest.create({
      data: {
        orgId: input.orgId,
        recipientEmail: input.recipientEmail.toLowerCase(),
        recipientName: input.recipientName?.trim() || null,
        recipientKind: input.recipientKind,
        clientId: input.clientId ?? null,
        caseId: input.caseId ?? null,
        firstMessageId: input.firstMessageId,
        previewBody: input.previewBody,
        subject: input.subject?.trim() || null,
        ctaUrl: input.ctaUrl,
        scheduledFor: new Date(Date.now() + digestDelayMs()),
        status: 'PENDING',
      },
      select: { id: true },
    });

    return { ok: true, digestId: digest.id, alreadyPending: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to schedule message email digest';
    console.error('[message-email-digest] schedule failed:', error);
    return { ok: false, error: msg };
  }
}

async function recipientStillHasUnread(digest: {
  orgId: string;
  recipientKind: string;
  clientId: string | null;
  caseId: string | null;
}): Promise<boolean> {
  if (digest.recipientKind === 'CLIENT') {
    const count = await prisma.message.count({
      where: {
        orgId: digest.orgId,
        isRead: false,
        direction: 'OUTBOUND',
        ...(digest.clientId ? { clientId: digest.clientId } : {}),
        ...(digest.caseId ? { caseId: digest.caseId } : {}),
      },
    });
    return count > 0;
  }

  const count = await prisma.message.count({
    where: {
      orgId: digest.orgId,
      isRead: false,
      direction: 'INBOUND',
      ...(digest.clientId ? { clientId: digest.clientId } : {}),
      ...(digest.caseId ? { caseId: digest.caseId } : {}),
    },
  });
  return count > 0;
}

/**
 * Cancel all PENDING digests for an organisation (e.g. when email notifications are disabled).
 */
export async function cancelAllPendingDigestsForOrg(orgId: string): Promise<number> {
  try {
    const result = await prisma.messageEmailDigest.updateMany({
      where: { orgId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    return result.count;
  } catch (error) {
    console.error('[message-email-digest] cancel-all-for-org failed:', error);
    return 0;
  }
}

/**
 * Cancel PENDING digests for a specific recipient (e.g. client personal email opt-out).
 */
export async function cancelPendingMessageEmailDigestsForRecipient(opts: {
  orgId: string;
  recipientKind: DigestRecipientKind;
  clientId?: string;
  recipientEmail?: string;
}): Promise<number> {
  try {
    const result = await prisma.messageEmailDigest.updateMany({
      where: {
        orgId: opts.orgId,
        recipientKind: opts.recipientKind,
        status: 'PENDING',
        ...(opts.clientId ? { clientId: opts.clientId } : {}),
        ...(opts.recipientEmail
          ? { recipientEmail: opts.recipientEmail.toLowerCase() }
          : {}),
      },
      data: { status: 'CANCELLED' },
    });
    return result.count;
  } catch (error) {
    console.error('[message-email-digest] cancel-for-recipient failed:', error);
    return 0;
  }
}

/**
 * Cancel PENDING digests when the recipient has no remaining unread messages.
 */
export async function cancelPendingDigestsIfCaughtUp(opts: {
  orgId: string;
  clientId?: string | null;
  caseId?: string | null;
}): Promise<void> {
  try {
    const pending = await prisma.messageEmailDigest.findMany({
      where: {
        orgId: opts.orgId,
        status: 'PENDING',
        ...(opts.clientId ? { clientId: opts.clientId } : {}),
        ...(opts.caseId ? { caseId: opts.caseId } : {}),
      },
      select: {
        id: true,
        orgId: true,
        recipientKind: true,
        clientId: true,
        caseId: true,
      },
    });

    for (const digest of pending) {
      const stillUnread = await recipientStillHasUnread(digest);
      if (!stillUnread) {
        await prisma.messageEmailDigest.update({
          where: { id: digest.id },
          data: { status: 'CANCELLED' },
        });
      }
    }
  } catch (error) {
    console.error('[message-email-digest] cancel-if-caught-up failed:', error);
  }
}

export type ProcessDigestsResult = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
};

/**
 * Send all PENDING digests whose scheduledFor has passed.
 */
export async function processDueMessageEmailDigests(
  limit = 50,
): Promise<ProcessDigestsResult> {
  const result: ProcessDigestsResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  const due = await prisma.messageEmailDigest.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: 'asc' },
    take: limit,
  });

  for (const digest of due) {
    result.processed += 1;
    try {
      const stillUnread = await recipientStillHasUnread(digest);
      if (!stillUnread) {
        await prisma.messageEmailDigest.update({
          where: { id: digest.id },
          data: { status: 'SKIPPED' },
        });
        result.skipped += 1;
        continue;
      }

      // Defence in depth: honour personal client opt-out at send time.
      if (digest.recipientKind === 'CLIENT' && digest.clientId) {
        const client = (await prisma.client.findFirst({
          where: { id: digest.clientId, orgId: digest.orgId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- field may precede generate
          select: { notificationPrefs: true } as any,
        })) as { notificationPrefs?: unknown } | null;
        const prefs = client?.notificationPrefs;
        const source =
          prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>) : {};
        if (source.emailMessages === false) {
          await prisma.messageEmailDigest.update({
            where: { id: digest.id },
            data: { status: 'CANCELLED' },
          });
          result.skipped += 1;
          continue;
        }
      }

      const notification = buildMessageNotificationEmail({
        recipientFirstName: digest.recipientName ?? undefined,
        messageBody: digest.previewBody,
        subject: digest.subject ?? undefined,
        ctaUrl: digest.ctaUrl,
      });

      const sendResult = await sendEmail({
        to: digest.recipientEmail,
        subject: notification.subject,
        body: notification.body,
        html: notification.html,
        unsubscribeUrl: unsubscribeUrlFor(digest.recipientKind as DigestRecipientKind),
      });

      if (!sendResult.ok) {
        console.error('[message-email-digest] send failed:', sendResult.error);
        result.failed += 1;
        // Leave PENDING so the next cron can retry; bump slightly to avoid tight loops.
        await prisma.messageEmailDigest.update({
          where: { id: digest.id },
          data: { scheduledFor: new Date(Date.now() + 15 * 60 * 1000) },
        });
        continue;
      }

      await prisma.messageEmailDigest.update({
        where: { id: digest.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      result.sent += 1;
    } catch (error) {
      console.error('[message-email-digest] process item failed:', error);
      result.failed += 1;
    }
  }

  return result;
}
