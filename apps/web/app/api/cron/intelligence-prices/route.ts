/**
 * GET + POST /api/cron/intelligence-prices — PRD-15 B8
 *
 * Vercel Cron job: daily at 08:00 UTC.
 * Queries HMLR SPARQL for sold-price aggregates by outward code and
 * upserts into LocalPriceStat. Updates DataFeedStatus for feedId HMLR_PRICES.
 *
 * Processes up to 50 outward codes per run (those in PostcodeGeography
 * that have no stat or whose stat is older than 30 days).
 *
 * Protected by Authorization: Bearer CRON_SECRET — same pattern as
 * /api/cron/intelligence-rates and /api/cron/message-email-digests.
 *
 * If no PostcodeGeography rows exist yet (cold start before any snapshot),
 * the job no-ops cleanly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runHmlrIngest } from '@/lib/intelligence/hmlr-ingest';

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}

async function runCron(req: NextRequest): Promise<NextResponse> {
  // ── Auth check — same pattern as other cron routes ───────────────────────
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

  try {
    const report = await runHmlrIngest();
    const statusCode = report.feedStatus === 'failure' ? 500 : 200;
    return NextResponse.json(
      { ok: report.feedStatus !== 'failure', ...report },
      { status: statusCode },
    );
  } catch (error) {
    console.error('[cron/intelligence-prices]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 },
    );
  }
}
