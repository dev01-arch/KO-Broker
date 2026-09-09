/**
 * GET /api/intelligence/snapshots/:id — PRD-15 B9
 *
 * Replay a single snapshot by ID. Org-scoped — returns 404 if the snapshot
 * belongs to a different org (same as cases: don't leak existence).
 *
 * Auth: Clerk session + mortgage_intelligence feature gate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createParamHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { formatSnapshotResponse } from '@/lib/intelligence/snapshot-service';

export const GET = createParamHandler<unknown, { id: string }>({
  method: 'GET',
  requiredFeature: 'mortgage_intelligence',
  handler: async (_req: NextRequest, { orgId, params }): Promise<NextResponse> => {
    const snapshot = await prisma.caseIntelligenceSnapshot.findFirst({
      where: { id: params.id, orgId },
    });

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Snapshot not found' } },
        { status: 404 },
      );
    }

    const data = await formatSnapshotResponse(snapshot);
    return NextResponse.json({ success: true, data });
  },
});
