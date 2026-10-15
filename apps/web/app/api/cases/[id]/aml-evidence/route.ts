/**
 * POST /api/cases/:id/aml-evidence
 * Records the adviser's identity check. It does not change stage gates.
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@ko/db';
import { prisma } from '@/lib/db';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';

type RouteContext = { params: Promise<{ id: string }> };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Request body must be JSON', 422);
    }
    const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const evidence = {
      idSeen: source.idSeen === true,
      nameMatches: source.nameMatches === true,
      addressMatches: source.addressMatches === true,
      recordedAt: new Date().toISOString(),
    };

    const caseRecord = await prisma.case.findFirst({
      where: { id, orgId },
      select: { id: true, factFind: { select: { personalDetails: true } } },
    });
    if (!caseRecord) return apiError('NOT_FOUND', 'Case not found', 404);

    const personalDetails = {
      ...(asRecord(caseRecord.factFind?.personalDetails) ?? {}),
      amlEvidence: evidence,
    } as Prisma.InputJsonValue;
    await prisma.factFind.upsert({
      where: { caseId: id },
      create: { caseId: id, personalDetails },
      update: { personalDetails },
    });

    return apiSuccess({ amlEvidence: evidence });
  } catch (error) {
    console.error('[POST /api/cases/:id/aml-evidence]', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
