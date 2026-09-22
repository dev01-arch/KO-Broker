/**
 * GET /api/lenders?q= — Lender directory search (PRD-16 W0)
 *
 * Returns up to 20 active/legacy lenders matching the query.
 * The "Other" sentinel row is always appended last.
 * INACTIVE lenders are excluded.
 *
 * Requires a valid Clerk session (any authenticated user in the org).
 * Lender data is global (no orgId), but the endpoint requires auth to
 * prevent unauthenticated enumeration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { searchLenders } from '@/lib/api/lenders-data';
import { LenderSearchQuerySchema } from '@ko/types';

export const GET = createHandler({
  method: 'GET',
  handler: async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? undefined;

    // Validate query param (optional, max safety)
    const parsed = LenderSearchQuerySchema.safeParse({ q });
    const query = parsed.success ? parsed.data.q : undefined;

    const lenders = await searchLenders(query);

    return NextResponse.json({ success: true, data: lenders });
  },
});
