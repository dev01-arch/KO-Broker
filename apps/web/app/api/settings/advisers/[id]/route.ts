/**
 * PATCH  /api/settings/advisers/[id]  — update visibility switches / deactivate (ADMIN only)
 * DELETE /api/settings/advisers/[id]  — hard delete adviser (ADMIN only, must be deactivated first)
 *
 * Core logic matches backend engineer (KO-Broker-test).
 * Frontend-only patches are marked below and must not change HIS behaviour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createParamHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { UpdateAdviserVisibilitySchema } from '@ko/types';
import { isPrismaMissingColumnError } from '@/lib/api/prisma-errors';

// ── PATCH /api/settings/advisers/[id] ─────────────────────────────────────────

export const PATCH = createParamHandler({
  method: 'PATCH',
  requiredRole: 'ADMIN',
  schema: UpdateAdviserVisibilitySchema,
  handler: async (_req: NextRequest, { body, user, orgId, params }) => {
    const { id } = params;

    // Confirm adviser belongs to this org and is not an ADMIN
    const adviser = await prisma.user.findFirst({
      where: { id, orgId, role: { not: 'ADMIN' } },
    });

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

    let updated: {
      id: string;
      email: string;
      isActive: boolean;
      canViewAllClients: boolean;
      canViewAccountDetails: boolean;
      canViewAiSummaries: boolean;
    };

    try {
      updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          isActive: true,
          canViewAllClients: true,
          canViewAccountDetails: true,
          canViewAiSummaries: true,
        },
      });
    } catch (error) {
      // === FRONTEND ADDITION: tolerate unmigrated visibility columns ===
      if (!isPrismaMissingColumnError(error)) throw error;

      const fallbackData = body.isActive !== undefined ? { isActive: body.isActive } : {};
      if (Object.keys(fallbackData).length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message:
                'Database schema is behind the app. Run: pnpm --filter @ko/db exec prisma db push',
            },
          },
          { status: 503 },
        );
      }

      const base = await prisma.user.update({
        where: { id },
        data: fallbackData,
        select: { id: true, email: true, isActive: true },
      });
      updated = {
        ...base,
        canViewAllClients: false,
        canViewAccountDetails: false,
        canViewAiSummaries: false,
      };
      // === END FRONTEND ADDITION ===
    }

    // === FRONTEND ADDITION: keep OrganisationMember.isActive in sync ===
    if (body.isActive !== undefined) {
      await prisma.organisationMember.updateMany({
        where: {
          orgId: orgId!,
          OR: [{ userId: id }, { email: adviser.email.toLowerCase() }],
        },
        data: { isActive: body.isActive },
      });
    }
    // === END FRONTEND ADDITION ===

    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'User',
      entityId: id,
      action: 'ADVISER_UPDATED',
      diff: { after: body },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  },
});

// ── DELETE /api/settings/advisers/[id] ────────────────────────────────────────

export const DELETE = createParamHandler({
  method: 'DELETE',
  requiredRole: 'ADMIN',
  handler: async (_req: NextRequest, { user, orgId, params }) => {
    const { id } = params;

    // Confirm adviser belongs to this org and is not an ADMIN
    const adviser = await prisma.user.findFirst({
      where: { id, orgId, role: { not: 'ADMIN' } },
    });

    if (!adviser) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Adviser not found.' } },
        { status: 404 },
      );
    }

    // Must be deactivated first to prevent accidental hard-deletes
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
        where: { assignedAdviserId: id },
        data: { assignedAdviserId: null },
      }),
      prisma.complianceRecord.updateMany({
        where: { userId: id },
        data: { userId: null },
      }),
      prisma.suitabilityReport.updateMany({
        where: { generatedBy: id },
        data: { generatedBy: null },
      }),
      prisma.auditLog.updateMany({
        where: { userId: id },
        data: { userId: null },
      }),
      // === FRONTEND ADDITION: remove linked OrganisationMember rows ===
      prisma.organisationMember.deleteMany({
        where: {
          orgId: orgId!,
          OR: [{ userId: id }, { email: adviser.email.toLowerCase() }],
        },
      }),
      // === END FRONTEND ADDITION ===
      prisma.user.delete({ where: { id } }),
    ]);

    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'User',
      entityId: id,
      action: 'ADVISER_DELETED',
      diff: { before: { email: adviser.email, role: adviser.role } },
    });

    return NextResponse.json({ success: true, message: 'Adviser permanently deleted.' }, { status: 200 });
  },
});
