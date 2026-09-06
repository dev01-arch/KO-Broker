/**
 * GET /api/intelligence/rates/current — PRD-15 B4
 *
 * Slim payload for the Calculator market context panel:
 *   2yr fixed, 5yr fixed, 75% variable — each with value + asAt date.
 *
 * Returns null for any series not yet ingested. Calculator panel
 * renders "stale / delayed" copy and continues working normally.
 *
 * No live BoE calls — reads from local cache only.
 * Auth: Clerk session, org-scoped (mortgage_intelligence feature gate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { getCurrentRates } from '@/lib/intelligence/rates-query';
import type { CurrentRatesResponse } from '@ko/types';

export const GET = createHandler({
  method: 'GET',
  requiredFeature: 'mortgage_intelligence',
  handler: async (_req: NextRequest): Promise<NextResponse> => {
    const data: CurrentRatesResponse = await getCurrentRates();
    return NextResponse.json({ success: true, data });
  },
});
