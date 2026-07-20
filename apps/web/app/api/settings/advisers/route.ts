/**
 * GET  /api/settings/advisers  — list advisers (backend User model + memberId for assignment)
 * POST /api/settings/advisers  — invite a new adviser (ADMIN) + sync OrganisationMember
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { sendAdviserInvite } from '@/lib/notifications/email';
import { InviteAdviserSchema } from '@ko/types';
import { isPrismaMissingColumnError } from '@/lib/api/prisma-errors';
import crypto from 'crypto';

const ADVISER_USER_SELECT = {
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
} as const;

async function memberIdMapForOrg(orgId: string) {
  const members = await prisma.organisationMember.findMany({
    where: { orgId },
    select: { id: true, userId: true, email: true },
  });

  const byUserId = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (const member of members) {
    byEmail.set(member.email.toLowerCase(), member.id);
    if (member.userId) byUserId.set(member.userId, member.id);
  }
  return { byUserId, byEmail };
}

function serializeAdviser(
  adviser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
    invitePending?: boolean;
    inviteTokenExpiry?: Date | null;
    canViewAllClients?: boolean;
    canViewAccountDetails?: boolean;
    canViewAiSummaries?: boolean;
    createdAt: Date;
  },
  memberLookup: { byUserId: Map<string, string>; byEmail: Map<string, string> },
) {
  return {
    ...adviser,
    invitePending: adviser.invitePending ?? false,
    inviteTokenExpiry: adviser.inviteTokenExpiry?.toISOString() ?? null,
    canViewAllClients: adviser.canViewAllClients ?? false,
    canViewAccountDetails: adviser.canViewAccountDetails ?? false,
    canViewAiSummaries: adviser.canViewAiSummaries ?? false,
    memberId:
      memberLookup.byUserId.get(adviser.id) ??
      memberLookup.byEmail.get(adviser.email.toLowerCase()) ??
      null,
  };
}

// ── GET /api/settings/advisers ────────────────────────────────────────────────

export const GET = createHandler({
  method: 'GET',
  // === FRONTEND ADDITION: any authenticated user can list advisers (assignment UI) ===
  // Backend spec: requiredRole ADMIN — relaxed here for client assignment dropdown.
  // === END FRONTEND ADDITION ===
  handler: async (_req: NextRequest, { orgId }) => {
    let advisers: Array<{
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      isActive: boolean;
      createdAt: Date;
      invitePending?: boolean;
      inviteTokenExpiry?: Date | null;
      canViewAllClients?: boolean;
      canViewAccountDetails?: boolean;
      canViewAiSummaries?: boolean;
    }> = [];

    try {
      advisers = await prisma.user.findMany({
        where: {
          orgId,
          role: { not: 'ADMIN' },
        },
        select: ADVISER_USER_SELECT,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error)) throw error;
      advisers = await prisma.user.findMany({
        where: {
          orgId,
          role: { not: 'ADMIN' },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const memberLookup = await memberIdMapForOrg(orgId!);

    return NextResponse.json(
      {
        success: true,
        data: advisers.map((adviser) => serializeAdviser(adviser, memberLookup)),
      },
      { status: 200 },
    );
  },
});

// ── POST /api/settings/advisers ───────────────────────────────────────────────

export const POST = createHandler({
  method: 'POST',
  requiredRole: 'ADMIN',
  schema: InviteAdviserSchema,
  handler: async (_req: NextRequest, { body, user, orgId }) => {
    const existing = await prisma.user.findFirst({
      where: { orgId, email: body.email },
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

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const adviser = await prisma.user.create({
      data: {
        clerkId: `pending_${inviteToken.slice(0, 16)}`,
        email: body.email,
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
      select: ADVISER_USER_SELECT,
    });

    // === FRONTEND ADDITION: dual-write OrganisationMember for client assignment UI ===
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.kobroker.co.uk';
    const inviteUrl = `${baseUrl}/adviser/invite?token=${inviteToken}`;

    const inviterName = user
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
      : 'Your administrator';

    await sendAdviserInvite({
      to: body.email,
      firstName: body.firstName,
      orgName: org.name,
      invitedBy: inviterName,
      inviteUrl,
    });

    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'User',
      entityId: adviser.id,
      action: 'ADVISER_INVITED',
      diff: { after: { email: body.email, role: 'ADVISER', invitePending: true } },
    });

    const memberLookup = {
      byUserId: new Map([[adviser.id, member.id]]),
      byEmail: new Map([[body.email.toLowerCase(), member.id]]),
    };

    return NextResponse.json(
      { success: true, data: serializeAdviser(adviser, memberLookup) },
      { status: 201 },
    );
  },
});
