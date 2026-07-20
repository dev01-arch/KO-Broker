/**
 * GET    /api/settings/advisers/[id]  — fetch one adviser (ADMIN)
 * PATCH  /api/settings/advisers/[id]  — update visibility switches / deactivate (ADMIN)
 * DELETE /api/settings/advisers/[id]  — hard delete adviser (ADMIN, must be deactivated first)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createParamHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { UpdateAdviserVisibilitySchema } from '@ko/types';
import { isPrismaMissingColumnError } from '@/lib/api/prisma-errors';

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

const ADVISER_BASE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

async function resolveAdviserUser(orgId: string, id: string) {
  try {
    const user = await prisma.user.findFirst({
      where: { id, orgId, role: { not: 'ADMIN' } },
      select: ADVISER_USER_SELECT,
    });
    if (user) return user;

    const member = await prisma.organisationMember.findFirst({
      where: { id, orgId },
      include: {
        user: { select: ADVISER_USER_SELECT },
      },
    });

    return member?.user ?? null;
  } catch (error) {
    // During local dev / rollout, permission columns may not exist yet.
    // Return the adviser with defaults so the settings UI doesn't hard-fail.
    if (!isPrismaMissingColumnError(error)) throw error;

    const user = await prisma.user.findFirst({
      where: { id, orgId, role: { not: 'ADMIN' } },
      select: ADVISER_BASE_SELECT,
    });
    if (user) {
      return {
        ...user,
        invitePending: false,
        inviteTokenExpiry: null,
        canViewAllClients: false,
        canViewAccountDetails: false,
        canViewAiSummaries: false,
      };
    }

    const member = await prisma.organisationMember.findFirst({
      where: { id, orgId },
      include: {
        user: { select: ADVISER_BASE_SELECT },
      },
    });

    if (!member?.user) return null;
    return {
      ...member.user,
      invitePending: false,
      inviteTokenExpiry: null,
      canViewAllClients: false,
      canViewAccountDetails: false,
      canViewAiSummaries: false,
    };
  }
}

async function memberIdForUser(orgId: string, userId: string, email: string) {
  const member = await prisma.organisationMember.findFirst({
    where: {
      orgId,
      OR: [{ userId }, { email: email.toLowerCase() }],
    },
    select: { id: true },
  });
  return member?.id ?? null;
}

function serializeAdviser(
  adviser: NonNullable<Awaited<ReturnType<typeof resolveAdviserUser>>>,
  memberId: string | null,
) {
  return {
    ...adviser,
    inviteTokenExpiry: adviser.inviteTokenExpiry?.toISOString() ?? null,
    memberId,
  };
}

export const GET = createParamHandler({
  method: 'GET',
  requiredRole: 'ADMIN',
  handler: async (_req: NextRequest, { orgId, params }) => {
    const adviser = await resolveAdviserUser(orgId!, params.id);
    if (!adviser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Adviser not found.' } },
        { status: 404 },
      );
    }

    const memberId = await memberIdForUser(orgId!, adviser.id, adviser.email);
    return NextResponse.json(
      { success: true, data: serializeAdviser(adviser, memberId) },
      { status: 200 },
    );
  },
});

export const PATCH = createParamHandler({
  method: 'PATCH',
  requiredRole: 'ADMIN',
  schema: UpdateAdviserVisibilitySchema,
  handler: async (_req: NextRequest, { body, user, orgId, params }) => {
    const adviser = await resolveAdviserUser(orgId!, params.id);

    if (!adviser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Adviser not found.' } },
        { status: 404 },
      );
    }

    const updateData = {
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.canViewAllClients !== undefined ? { canViewAllClients: body.canViewAllClients } : {}),
      ...(body.canViewAccountDetails !== undefined
        ? { canViewAccountDetails: body.canViewAccountDetails }
        : {}),
      ...(body.canViewAiSummaries !== undefined ? { canViewAiSummaries: body.canViewAiSummaries } : {}),
    };

    let updated:
      | Awaited<ReturnType<typeof resolveAdviserUser>>
      | null = null;

    try {
      updated = await prisma.user.update({
        where: { id: adviser.id },
        data: updateData,
        select: ADVISER_USER_SELECT,
      });
    } catch (error) {
      if (!isPrismaMissingColumnError(error)) throw error;

      // Permissions columns don't exist yet; update only what we can.
      const fallbackData = body.isActive !== undefined ? { isActive: body.isActive } : {};
      if (Object.keys(fallbackData).length > 0) {
        updated = await prisma.user.update({
          where: { id: adviser.id },
          data: fallbackData,
          select: ADVISER_BASE_SELECT,
        });
        // Re-attach missing fields with defaults for response compatibility.
        updated = {
          ...(updated as NonNullable<typeof adviser>),
          invitePending: false,
          inviteTokenExpiry: null,
          canViewAllClients: false,
          canViewAccountDetails: false,
          canViewAiSummaries: false,
        } as typeof adviser;
      } else {
        updated = adviser;
      }
    }

    if (body.isActive !== undefined) {
      await prisma.organisationMember.updateMany({
        where: {
          orgId: orgId!,
          OR: [{ userId: adviser.id }, { email: adviser.email.toLowerCase() }],
        },
        data: { isActive: body.isActive },
      });
    }

    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'User',
      entityId: adviser.id,
      action: 'ADVISER_UPDATED',
      diff: { after: body },
    });

    const memberId = await memberIdForUser(orgId!, updated!.id, updated!.email);
    return NextResponse.json(
      { success: true, data: serializeAdviser(updated!, memberId) },
      { status: 200 },
    );
  },
});

export const DELETE = createParamHandler({
  method: 'DELETE',
  requiredRole: 'ADMIN',
  handler: async (_req: NextRequest, { user, orgId, params }) => {
    const adviser = await resolveAdviserUser(orgId!, params.id);

    if (!adviser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Adviser not found.' } },
        { status: 404 },
      );
    }

    if (adviser.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Adviser must be deactivated before deletion. Deactivate them first.',
          },
        },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.case.updateMany({
        where: { assignedAdviserId: adviser.id },
        data: { assignedAdviserId: null },
      }),
      prisma.complianceRecord.updateMany({
        where: { userId: adviser.id },
        data: { userId: null },
      }),
      prisma.suitabilityReport.updateMany({
        where: { generatedBy: adviser.id },
        data: { generatedBy: null },
      }),
      prisma.auditLog.updateMany({
        where: { userId: adviser.id },
        data: { userId: null },
      }),
      prisma.organisationMember.deleteMany({
        where: {
          orgId: orgId!,
          OR: [{ userId: adviser.id }, { email: adviser.email.toLowerCase() }],
        },
      }),
      prisma.user.delete({ where: { id: adviser.id } }),
    ]);

    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'User',
      entityId: adviser.id,
      action: 'ADVISER_DELETED',
      diff: { before: { email: adviser.email, role: adviser.role } },
    });

    return NextResponse.json({ success: true, message: 'Adviser permanently deleted.' }, { status: 200 });
  },
});
