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
import { caseAssignedToAdviserWhere, isRestrictedAdviser } from '@/lib/auth/adviser-scope';

/** Prefer latest ref over full-table count — much faster as orgs grow. */
async function nextCaseReferenceSequence(orgId: string): Promise<number> {
  const year = new Date().getFullYear();
  const prefix = `KOF-${year}-`;
  const latest = await prisma.case.findFirst({
    where: { orgId, referenceNumber: { startsWith: prefix } },
    orderBy: { referenceNumber: 'desc' },
    select: { referenceNumber: true },
  });
  if (!latest?.referenceNumber) return 1;
  const parsed = Number.parseInt(latest.referenceNumber.slice(prefix.length), 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
}

// ── GET /api/cases ────────────────────────────────────────────────────────────

export const GET = createHandler({
    method: 'GET',
    handler: async (req: NextRequest, { orgId }) => {
        const currentUser = await getCurrentUser();
        const isAdviserWithRestriction = isRestrictedAdviser(currentUser);
        const hideAccountDetails =
            currentUser?.role === 'ADVISER' && !currentUser.canViewAccountDetails;

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') ?? '25', 10)));
        const stage = searchParams.get('stage') ?? undefined;
        const type = searchParams.get('type') ?? undefined;
        const adviserId = searchParams.get('adviserId') ?? undefined;
        const search = searchParams.get('search') ?? '';

        const andFilters = [
            ...(isAdviserWithRestriction && currentUser
                ? [caseAssignedToAdviserWhere(currentUser.id)]
                : adviserId
                  ? [{ assignedAdviserId: adviserId }]
                  : []),
            ...(search
                ? [
                    {
                      OR: [
                        { referenceNumber: { contains: search, mode: 'insensitive' as const } },
                        { client: { firstName: { contains: search, mode: 'insensitive' as const } } },
                        { client: { lastName: { contains: search, mode: 'insensitive' as const } } },
                      ],
                    },
                  ]
                : []),
        ];

        const where = {
            orgId,
            ...(stage ? { stage: stage as never } : {}),
            ...(type ? { type: type as never } : {}),
            ...(andFilters.length > 0 ? { AND: andFilters } : {}),
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
        // Verify client belongs to same org (id only — avoid loading full row).
        const client = await prisma.client.findFirst({
            where: { id: body.clientId, orgId },
            select: { id: true },
        });
        if (!client) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } },
                { status: 404 }
            );
        }

        const ltv =
            body.loanAmount && body.propertyValue
                ? calculateLTV(body.loanAmount, body.propertyValue)
                : null;

        let newCase = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            const referenceNumber = generateReference('KOF', await nextCaseReferenceSequence(orgId!));
            try {
                newCase = await prisma.case.create({
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
                        client: {
                            select: {
                                id: true,
                                clientType: true,
                                companyName: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                        adviser: { select: { id: true, firstName: true, lastName: true } },
                        _count: { select: { messages: true, documents: true } },
                    },
                });
                break;
            } catch (error) {
                // Unique ref race — retry with next sequence.
                const code =
                    error && typeof error === 'object' && 'code' in error
                        ? String((error as { code?: string }).code)
                        : '';
                if (code === 'P2002' && attempt < 2) continue;
                throw error;
            }
        }

        if (!newCase) {
            return NextResponse.json(
                { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not create case' } },
                { status: 500 },
            );
        }

        // Do not block the API response on audit write.
        void logAuditEvent({
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
