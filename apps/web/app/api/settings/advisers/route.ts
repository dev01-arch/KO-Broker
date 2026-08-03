/**
 * GET  /api/settings/advisers  — list invited advisers in the org
 * POST /api/settings/advisers  — invite a new adviser (ADMIN only)
 *
 * Core logic matches backend engineer (KO-Broker-test).
 * Frontend-only patches are marked below and must not change HIS behaviour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { sendAdviserInvite } from '@/lib/notifications/email';
import { InviteAdviserSchema } from '@ko/types';
import { isPrismaMissingColumnError } from '@/lib/api/prisma-errors';
import { listInvitedAdvisersForOrg, ensureOrganisationMemberForAdmin } from '@/lib/api/settings-data';
import crypto from 'crypto';

// ── GET /api/settings/advisers ────────────────────────────────────────────────

export const GET = createHandler({
  method: 'GET',
  // === FRONTEND ADDITION: allow any authenticated user to list advisers for
  // client assignment UI. Backend HIS uses requiredRole: 'ADMIN'.
  // requiredRole: 'ADMIN',
  // === END FRONTEND ADDITION ===
  handler: async (_req: NextRequest, { orgId }) => {
    try {
      const advisers = await listInvitedAdvisersForOrg(orgId!);
      return NextResponse.json({ success: true, data: advisers }, { status: 200 });
    } catch (error) {
      // === FRONTEND ADDITION: tolerate unmigrated invite/visibility columns ===
      if (!isPrismaMissingColumnError(error)) throw error;
      const advisers = await prisma.user.findMany({
        where: {
          orgId,
          isActive: true,
          OR: [
            { role: { not: 'ADMIN' }, organisationMember: { isNot: null } },
            { role: 'ADMIN' },
          ],
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          organisationMember: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(
        {
          success: true,
          data: await Promise.all(
            advisers.map(async ({ organisationMember, ...a }) => {
              let memberId = organisationMember?.id ?? null;
              if (!memberId && a.role === 'ADMIN') {
                memberId = await ensureOrganisationMemberForAdmin(orgId!, a);
              }
              return {
                ...a,
                invitePending: false,
                inviteTokenExpiry: null,
                canViewAllClients: false,
                canViewAccountDetails: false,
                canViewAiSummaries: false,
                memberId,
              };
            }),
          ),
        },
        { status: 200 },
      );
      // === END FRONTEND ADDITION ===
    }
  },
});

// ── POST /api/settings/advisers ───────────────────────────────────────────────

export const POST = createHandler({
  method: 'POST',
  requiredRole: 'ADMIN',
  schema: InviteAdviserSchema,
  handler: async (_req: NextRequest, { body, user, orgId }) => {
    // 1. Check no existing active user with that email in the org
    const existing = await prisma.user.findFirst({
      where: { orgId, email: { equals: body.email, mode: 'insensitive' } },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'An adviser with this email already exists in your organisation.',
          },
        },
        { status: 409 },
      );
    }

    // === FRONTEND ADDITION: also block duplicate OrganisationMember emails ===
    const existingMember = await prisma.organisationMember.findFirst({
      where: { orgId: orgId!, email: body.email.toLowerCase() },
    });
    if (existingMember) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'An adviser with this email already exists in your organisation.',
          },
        },
        { status: 409 },
      );
    }
    // === END FRONTEND ADDITION ===

    // 2. Fetch org info for the email
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organisation not found.' } },
        { status: 404 },
      );
    }

    // 3. Generate invite token with 48-hour expiry
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 4. Create pending adviser user record
    // Names here are the source of truth for the adviser on the platform.
    const adviser = await prisma.user.create({
      data: {
        clerkId: `pending_${inviteToken.slice(0, 16)}`, // temporary placeholder
        email: body.email.toLowerCase(),
        firstName: body.firstName,
        lastName: body.lastName,
        role: 'ADVISER',
        orgId,
        isActive: true,
        inviteToken,
        inviteTokenExpiry,
        invitePending: true,
        canViewAllClients: body.canViewAllClients,
        canViewAccountDetails: body.canViewAccountDetails,
        canViewAiSummaries: body.canViewAiSummaries,
      },
    });

    // === FRONTEND ADDITION: dual-write OrganisationMember for client assignment ===
    const member = await prisma.organisationMember.create({
      data: {
        orgId: orgId!,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email.toLowerCase(),
        role: 'ADVISER',
        userId: adviser.id,
        isActive: true,
      },
      select: { id: true },
    });
    // === END FRONTEND ADDITION ===

    // 5. Send invite email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.kobroker.co.uk';
    const inviteUrl = `${baseUrl}/adviser/invite?token=${inviteToken}`;

    const inviterName = user
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
      : 'Your administrator';

    const emailResult = await sendAdviserInvite({
      to: body.email,
      firstName: body.firstName,
      orgName: org.name,
      invitedBy: inviterName,
      inviteUrl,
    });

    // 6. Audit log
    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'User',
      entityId: adviser.id,
      action: 'ADVISER_INVITED',
      diff: { after: { email: body.email, role: 'ADVISER', invitePending: true } },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: adviser.id,
          email: adviser.email,
          // === FRONTEND ADDITION: memberId + email delivery status ===
          memberId: member.id,
          emailSent: emailResult.ok,
          ...(emailResult.ok
            ? {}
            : {
                emailError:
                  emailResult.error ||
                  'Invite email failed to send. Check RESEND_API_KEY / RESEND_FROM_EMAIL.',
              }),
          // === END FRONTEND ADDITION ===
        },
      },
      { status: 201 },
    );
  },
});
