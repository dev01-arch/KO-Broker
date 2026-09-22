/**
 * GET + POST /api/cron/lenders-fca — PRD-16 W6
 *
 * Vercel Cron job: monthly on the 1st at 06:00 UTC (configured in vercel.json).
 *
 * Keeps the lenders table current against the FCA FS Register:
 *   - Verifies existing lenders with known FRNs are still authorised
 *   - Discovers new mortgage lenders via FCA search
 *   - Marks long-absent FCA lenders as INACTIVE (32-day grace period)
 *   - Updates DataFeedStatus feedId='FCA_LENDERS'
 *
 * Requires env vars: FCA_API_EMAIL, FCA_API_KEY
 * Register free at: https://register.fca.org.uk/developer/s/
 *
 * Protected by Authorization: Bearer CRON_SECRET (same pattern as other cron routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { runFcaIngest } from '@/lib/api/lenders-fca-ingest';

async function runCron(req: NextRequest): Promise<NextResponse> {
  // ── Auth check — mirrors intelligence-rates pattern ───────────────────────
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

  // ── Env var guard ─────────────────────────────────────────────────────────
  if (!process.env.FCA_API_EMAIL || !process.env.FCA_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'FCA_API_EMAIL and FCA_API_KEY are required. ' +
          'Register for a free key at https://register.fca.org.uk/developer/s/',
      },
      { status: 503 },
    );
  }

  try {
    const report = await runFcaIngest();
    const statusCode = report.feedStatus === 'failure' ? 500 : 200;
    return NextResponse.json({ ok: report.feedStatus !== 'failure', ...report }, { status: statusCode });
  } catch (error) {
    console.error('[cron/lenders-fca]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}
