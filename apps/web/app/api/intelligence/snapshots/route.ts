/**
 * POST /api/intelligence/snapshots — PRD-15 B7
 * GET  /api/intelligence/snapshots?caseId= — PRD-15 B9 (optional history)
 *
 * POST: Validate → generate snapshot → return fully rendered result.
 * No live BoE/HMLR HTTP calls on this path — cache reads only.
 * Empty rate cache → 503 RATE_DATA_NOT_READY.
 *
 * GET: Returns the snapshot history for a caseId, newest first.
 *      Org-scoped only — no adviser restriction on read (consistent with cases API).
 *
 * Auth: Clerk session + mortgage_intelligence feature gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { CreateSnapshotSchema } from '@ko/types';
import { createSnapshot, SnapshotRateDataError } from '@/lib/intelligence/snapshot-service';
import { prisma } from '@/lib/db';

// ── POST /api/intelligence/snapshots ─────────────────────────────────────────

export const POST = createHandler({
  method: 'POST',
  requiredFeature: 'mortgage_intelligence',
  schema: CreateSnapshotSchema,
  handler: async (_req: NextRequest, { body, user, orgId }): Promise<NextResponse> => {
    try {
      const snapshot = await createSnapshot(body, orgId!, user!.id);
      return NextResponse.json({ success: true, data: snapshot }, { status: 201 });
    } catch (err) {
      if (err instanceof SnapshotRateDataError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_DATA_NOT_READY',
              message: err.message,
            },
          },
          { status: 503 },
        );
      }
      // Case not found (from scope check inside service)
      const asAny = err as { code?: string; status?: number };
      if (asAny.code === 'NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
          { status: 404 },
        );
      }
      throw err; // let createHandler's handleError deal with anything else
    }
  },
});

// ── GET /api/intelligence/snapshots?caseId= ───────────────────────────────────

export const GET = createHandler({
  method: 'GET',
  requiredFeature: 'mortgage_intelligence',
  handler: async (req: NextRequest, { orgId }): Promise<NextResponse> => {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get('caseId') ?? undefined;

    const snapshots = await prisma.caseIntelligenceSnapshot.findMany({
      where: {
        orgId,
        ...(caseId ? { caseId } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        caseId: true,
        source: true,
        confirmedAt: true,
        generatedAt: true,
        postcode: true,
        outwardCode: true,
        propertyValue: true,
        mortgageAmount: true,
        termYears: true,
        ltv: true,
        monthlyPayment: true,
        marketSignal: true,
        insightText: true,
        watchText: true,
      },
    });

    return NextResponse.json({ success: true, data: snapshots });
  },
});
