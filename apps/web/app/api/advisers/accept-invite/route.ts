/**
 * POST /api/advisers/accept-invite
 *
 * Called when an invited adviser clicks the email link and completes sign-up/sign-in.
 * The proxy injects x-user-id (Clerk ID) after auth, so we can link the Clerk account
 * to the pending User record.
 *
 * requireAuth: false — the route reads the Clerk ID from the header directly
 * because the user may be mid sign-up flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { AcceptAdviserInviteSchema } from '@ko/types';
import { headers } from 'next/headers';
import { createClerkClient } from '@clerk/nextjs/server';


export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  schema: AcceptAdviserInviteSchema,
  handler: async (_req: NextRequest, { body }) => {
    // 1. Validate token exists and has not expired
    const adviser = await prisma.user.findUnique({
      where: { inviteToken: body.token },
    });

    if (!adviser) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invite link is invalid or has already been used.' } },
        { status: 400 }
      );
    }

    if (!adviser.invitePending) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_ACCEPTED', message: 'This invite has already been accepted.' } },
        { status: 400 }
      );
    }

    if (adviser.inviteTokenExpiry && adviser.inviteTokenExpiry < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXPIRED', message: 'This invite link has expired. Ask your admin to resend the invite.' } },
        { status: 400 }
      );
    }

    // 2. Get Clerk user ID from proxy header (set after sign-in/sign-up)
    const headerList = await headers();
    const clerkId = headerList.get('x-user-id');

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'You must be signed in to accept an invite.' } },
        { status: 401 }
      );
    }

    // Sync organization membership on Clerk
    if (adviser.orgId) {
      const clerkRole = adviser.role === 'ADMIN' ? 'org:admin' : 'org:member';
      try {
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        await clerkClient.organizations.createOrganizationMembership({
          organizationId: adviser.orgId,
          userId: clerkId,
          role: clerkRole,
        });
        console.log(`[CLERK MEMBERSHIP SYNC SUCCESS] Added user ${clerkId} to org ${adviser.orgId} with role ${clerkRole}`);
      } catch (err: any) {
        const isAlreadyMember = err?.errors?.[0]?.code === 'organization_membership_already_exists' || 
                                err?.message?.includes('already a member') ||
                                err?.status === 422;
        if (isAlreadyMember) {
          console.log(`[CLERK MEMBERSHIP SYNC INFO] User ${clerkId} is already a member of org ${adviser.orgId}`);
        } else {
          console.error('[CLERK MEMBERSHIP SYNC ERROR]', err);
        }
      }
    }

    // 3. Check if a different DB user record exists for this Clerk ID (e.g. created by webhook)
    const existingClerkUser = await prisma.user.findUnique({ where: { clerkId } });

    if (existingClerkUser && existingClerkUser.id !== adviser.id) {
      // Merge: delete the shell record and update the real Clerk user record
      await prisma.user.update({
        where: { id: existingClerkUser.id },
        data: {
          orgId: adviser.orgId,
          role: adviser.role,
          isActive: true,
          invitePending: false,
          canViewAllClients: adviser.canViewAllClients,
          canViewAccountDetails: adviser.canViewAccountDetails,
          canViewAiSummaries: adviser.canViewAiSummaries,
        },
      });
      await prisma.user.delete({ where: { id: adviser.id } });

      await logAuditEvent({
        orgId: adviser.orgId!,
        userId: existingClerkUser.id,
        entityType: 'User',
        entityId: existingClerkUser.id,
        action: 'ADVISER_INVITE_ACCEPTED',
        diff: { after: { email: adviser.email, orgId: adviser.orgId } },
      });

      return NextResponse.json({ success: true, message: 'Invite accepted.' }, { status: 200 });
    }

    // 4. Link the Clerk ID to the pending shell user and activate
    await prisma.user.update({
      where: { id: adviser.id },
      data: {
        clerkId,
        invitePending: false,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    });

    await logAuditEvent({
      orgId: adviser.orgId!,
      userId: adviser.id,
      entityType: 'User',
      entityId: adviser.id,
      action: 'ADVISER_INVITE_ACCEPTED',
      diff: { after: { email: adviser.email, clerkId } },
    });

    return NextResponse.json({ success: true, message: 'Invite accepted. Welcome to KO Broker.' }, { status: 200 });
  },
});
