/**
 * GET + POST /api/cron/lenders-fca — PRD-16 W6
 *
 * Vercel Cron job: monthly on the 1st at 06:00 UTC.
 * Appends newly authorised lenders from the FCA FS Register to the lenders table
 * and marks previously-active FCA lenders as INACTIVE when absent for 2 consecutive runs.
 *
 * Protected by Authorization: Bearer CRON_SECRET (same pattern as other cron routes).
 *
 * CURRENT STATUS: NOT_IMPLEMENTED (HTTP 501)
 * The FCA bulk-data source format must be confirmed before this implementation
 * is completed. See PRD-16 W0 spike decision in:
 *   Doc/PRD-16-Backend-Engineering-Plan.md — Section 7: Decisions Log
 *
 * Once the spike decision is recorded:
 *   - If FCA bulk file: implement fetchFcaLenders() in lib/api/lenders-fca-ingest.ts
 *   - If CSV fallback: add POST /api/settings/lenders/import (manual upload route)
 *     and keep this cron returning 501 until the FCA source is available
 *
 * The seed (189 lenders from Appendix A) is already live. This cron is the
 * monthly update mechanism — its absence does not break lender search.
 */

import { NextRequest, NextResponse } from 'next/server';

async function runCron(req: NextRequest): Promise<NextResponse> {
  // ── Auth check — mirrors intelligence-rates / intelligence-prices pattern ──
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const authHeader = req.headers.get('authorization') ?? '';
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'CRON_SECRET is required in production' },
      { status: 503 },
    );
  }

  // ── Not yet implemented — awaiting W0 FCA spike decision ─────────────────
  return NextResponse.json(
    {
      ok: false,
      status: 'NOT_IMPLEMENTED',
      message:
        'FCA lender sync is not yet implemented. ' +
        'Complete the W0 spike decision (FCA bulk file vs Settings CSV fallback) ' +
        'before implementing lib/api/lenders-fca-ingest.ts. ' +
        'The seed (189 lenders) is already live and lender search is functional.',
    },
    { status: 501 },
  );
}

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}
