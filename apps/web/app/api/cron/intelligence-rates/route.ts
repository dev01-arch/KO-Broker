/**
 * GET + POST /api/cron/intelligence-rates — PRD-15 B3
 *
 * Vercel Cron job: daily at 07:00 UTC.
 * Fetches the latest BoE quoted mortgage rate data for all configured series
 * and upserts into RateSeriesPoint. Updates DataFeedStatus for feedId BOE_RATES.
 *
 * Protected by Authorization: Bearer CRON_SECRET (same pattern as
 * /api/cron/message-email-digests). In production CRON_SECRET is required.
 * In dev/staging the route can be triggered manually without a secret.
 *
 * No-ops if all series for this calendar month are already ingested.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runBoEIngest } from '@/lib/intelligence/boe-ingest';

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}

async function runCron(req: NextRequest): Promise<NextResponse> {
  // ── Auth check — same pattern as message-email-digests ───────────────────
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
    const report = await runBoEIngest();

    const statusCode = report.feedStatus === 'failure' ? 500 : 200;
    return NextResponse.json({ ok: report.feedStatus !== 'failure', ...report }, { status: statusCode });
  } catch (error) {
    console.error('[cron/intelligence-rates]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 },
    );
  }
}
