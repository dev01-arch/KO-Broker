/**
 * GET  /api/cases  — paginated case list (org-scoped, with filters)
 * POST /api/cases  — create a new case
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { CreateCaseSchema } from '@ko/types';
import { generateReference, calculateLTV } from '@ko/utils';
import { getCurrentUser, maskCaseFinancials } from '@/lib/auth';

// ── GET /api/cases ────────────────────────────────────────────────────────────

export const GET = createHandler({
    method: 'GET',
    handler: async (req: NextRequest, { orgId }) => {
        const currentUser = await getCurrentUser();
        const isAdviserWithRestriction =
            currentUser?.role === 'ADVISER' && !currentUser.canViewAllClients;
        const hideAccountDetails =
            currentUser?.role === 'ADVISER' && !currentUser.canViewAccountDetails;

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') ?? '25', 10)));
        const stage = searchParams.get('stage') ?? undefined;
        const type = searchParams.get('type') ?? undefined;
        const adviserId = searchParams.get('adviserId') ?? undefined;
        const search = searchParams.get('search') ?? '';

        const where = {
            orgId,
            ...(stage ? { stage: stage as never } : {}),
            ...(type ? { type: type as never } : {}),
            // Scope to assigned adviser if restricted
            ...(isAdviserWithRestriction && currentUser
                ? { assignedAdviserId: currentUser.id }
                : adviserId
                ? { assignedAdviserId: adviserId }
                : {}),
            ...(search
                ? {
                    OR: [
                        { referenceNumber: { contains: search, mode: 'insensitive' as const } },
                        { client: { firstName: { contains: search, mode: 'insensitive' as const } } },
                        { client: { lastName: { contains: search, mode: 'insensitive' as const } } },
                    ],
                }
                : {}),
        };

        const [cases, total] = await Promise.all([
            prisma.case.findMany({
                where,
                skip: (page - 1) * perPage,
                take: perPage,
                orderBy: { updatedAt: 'desc' },
                include: {
                    client: { select: { id: true, firstName: true, lastName: true, referenceNumber: true, isVulnerable: true } },
                    adviser: { select: { id: true, firstName: true, lastName: true } },
                    _count: { select: { messages: true, documents: true } },
                },
            }),
            prisma.case.count({ where }),
        ]);

        let finalCases = cases;
        if (hideAccountDetails) {
            finalCases = cases.map((c) => maskCaseFinancials(c));
        }

        return NextResponse.json(
            { success: true, data: finalCases, meta: { total, page, perPage } },
            { status: 200 }
        );
    },
});

// ── POST /api/cases ───────────────────────────────────────────────────────────

export const POST = createHandler({
    method: 'POST',
    schema: CreateCaseSchema,
    handler: async (_req: NextRequest, { body, user, orgId }) => {
        // Verify client belongs to same org
        const client = await prisma.client.findFirst({
            where: { id: body.clientId, orgId },
        });
        if (!client) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } },
                { status: 404 }
            );
        }

        // Generate reference number
        const count = await prisma.case.count({ where: { orgId } });
        const referenceNumber = generateReference('KOF', count + 1);

        // Calculate LTV if both values provided
        const ltv =
            body.loanAmount && body.propertyValue
                ? calculateLTV(body.loanAmount, body.propertyValue)
                : null;

        const newCase = await prisma.case.create({
            data: {
                orgId: orgId!,
                clientId: body.clientId,
                referenceNumber,
                type: body.type,
                stage: 'ENQUIRY',
                propertyValue: body.propertyValue,
                loanAmount: body.loanAmount,
                ltv,
                termYears: body.termYears,
                assignedAdviserId: user?.id,
            },
            include: {
                client: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await logAuditEvent({
            orgId: orgId!,
            userId: user?.id,
            entityType: 'Case',
            entityId: newCase.id,
            action: 'CASE_CREATED',
            diff: {
                after: {
                    referenceNumber: newCase.referenceNumber,
                    type: newCase.type,
                    stage: newCase.stage,
                    clientId: newCase.clientId,
                },
            },
        });

        return NextResponse.json({ success: true, data: newCase }, { status: 201 });
    },
});
