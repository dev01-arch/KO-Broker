import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createParamHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent, computeDiff } from '@/lib/compliance/audit';
import { requireVisibility, getCurrentUser, maskClientFinancials, maskCaseFinancials } from '@/lib/auth';
import { UpdateClientSchema } from '@ko/types';

// ── GET /api/clients/[id] ─────────────────────────────────────────────────────

export const GET = createParamHandler<unknown, { id: string }>({
    method: 'GET',
    handler: async (_req: NextRequest, { orgId, params }) => {
        const { id } = params;

        // ADVISER with canViewAllClients=false: only show clients from their assigned cases
        const currentUser = await getCurrentUser();
        const isAdviserWithRestriction =
            currentUser?.role === 'ADVISER' && !currentUser.canViewAllClients;
        const hideAccountDetails =
            currentUser?.role === 'ADVISER' && !currentUser.canViewAccountDetails;

        const client = await prisma.client.findFirst({
            where: {
                id,
                orgId,
                ...(isAdviserWithRestriction && currentUser
                    ? { cases: { some: { assignedAdviserId: currentUser.id } } }
                    : {}),
            },
            include: {
                cases: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        adviser: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
                // === FRONTEND ADDITION: assigned member for dashboard UI ===
                assignedMember: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                // === END FRONTEND ADDITION ===
                _count: { select: { messages: true, documents: true } },
            },
        });

        if (!client) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } },
                { status: 404 }
            );
        }

        let responseData = client;
        if (hideAccountDetails) {
            responseData = maskClientFinancials(client);
            responseData.cases = client.cases.map((c) => maskCaseFinancials(c));
        }

        return NextResponse.json({ success: true, data: responseData }, { status: 200 });
    },
});

// ── PATCH /api/clients/[id] ───────────────────────────────────────────────────

export const PATCH = createParamHandler<z.infer<typeof UpdateClientSchema>, { id: string }>({
    method: 'PATCH',
    schema: UpdateClientSchema,
    handler: async (_req: NextRequest, { body, user, orgId, params }) => {
        const { id } = params;

        // Advisers must have canViewAllClients to edit client records
        // === FRONTEND ADDITION: ADMIN always allowed; skip hard fail for org admins ===
        const currentUser = await getCurrentUser();
        if (currentUser?.role !== 'ADMIN') {
            await requireVisibility('canViewAllClients');
        }
        // === END FRONTEND ADDITION ===

        const existing = await prisma.client.findFirst({ where: { id, orgId } });
        if (!existing) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } },
                { status: 404 }
            );
        }

        const updated = await prisma.client.update({
            where: { id },
            data: {
                ...body,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
                updatedAt: new Date(),
            },
        });

        const diff = computeDiff(
            existing as unknown as Record<string, unknown>,
            updated as unknown as Record<string, unknown>
        );

        await logAuditEvent({
            orgId: orgId!,
            userId: user?.id,
            entityType: 'Client',
            entityId: id,
            action: 'CLIENT_UPDATED',
            diff,
        });

        return NextResponse.json({ success: true, data: updated }, { status: 200 });
    },
});
