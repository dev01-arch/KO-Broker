/**
 * POST /api/settings/advisers/[id]/resend-invite
 * Re-generates the invite token and resends the invite email (ADMIN only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createParamHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { sendAdviserInvite } from '@/lib/notifications/email';
import crypto from 'crypto';

async function resolveAdviserUserId(orgId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, orgId, role: { not: 'ADMIN' } },
    select: { id: true },
  });
  if (user) return user.id;

  const member = await prisma.organisationMember.findFirst({
    where: { id, orgId },
    select: { userId: true },
  });
  return member?.userId ?? null;
}

export const POST = createParamHandler({
  method: 'POST',
  requiredRole: 'ADMIN',
  handler: async (_req: NextRequest, { user, orgId, params }) => {
    const adviserUserId = await resolveAdviserUserId(orgId!, params.id);
    if (!adviserUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pending adviser not found.' } },
        { status: 404 },
      );
    }

    const adviser = await prisma.user.findFirst({
      where: { id: adviserUserId, orgId, role: { not: 'ADMIN' }, invitePending: true },
    });

    if (!adviser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pending adviser not found.' } },
        { status: 404 }
      );
    }

    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    // Regenerate token with fresh 48h window
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: adviserUserId },
      data: { inviteToken, inviteTokenExpiry },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.kobroker.co.uk';
    const inviteUrl = `${baseUrl}/adviser/invite?token=${inviteToken}`;

    const inviterName = user
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
      : 'Your administrator';

    await sendAdviserInvite({
      to: adviser.email,
      firstName: adviser.firstName ?? adviser.email,
      orgName: org?.name ?? 'your organisation',
      invitedBy: inviterName,
      inviteUrl,
    });

    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'User',
      entityId: adviserUserId,
      action: 'ADVISER_INVITE_RESENT',
      diff: { after: { email: adviser.email } },
    });

    return NextResponse.json({ success: true, message: 'Invite resent successfully.' }, { status: 200 });
  },
});
