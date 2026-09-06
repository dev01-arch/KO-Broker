/**
 * GET /api/intelligence/overview — PRD-15 B4
 *
 * Returns cached BoE rate cards, market signal, and feed statuses.
 * No live BoE/HMLR calls on this request — reads from local cache only.
 *
 * If no rate data has been ingested yet: returns success with empty rates
 * array and null signal. Frontend renders the "waiting for first import"
 * empty state. NEVER returns invented numbers.
 *
 * Auth: Clerk session, org-scoped (mortgage_intelligence feature gate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import {
  getOverviewRateCards,
  computeMarketSignal,
  getIntelFeedStatuses,
} from '@/lib/intelligence/rates-query';
import type { OverviewResponse } from '@ko/types';

export const GET = createHandler({
  method: 'GET',
  requiredFeature: 'mortgage_intelligence',
  handler: async (_req: NextRequest): Promise<NextResponse> => {
    const [rates, marketSignal, feedStatuses] = await Promise.all([
      getOverviewRateCards(),
      computeMarketSignal(),
      getIntelFeedStatuses(),
    ]);

    const data: OverviewResponse = {
      rates,
      marketSignal,
      feedStatuses,
    };

    return NextResponse.json({ success: true, data });
  },
});
