import { NextRequest, NextResponse } from 'next/server';
import { processDueMessageEmailDigests } from '@/lib/notifications/message-email-digest';

/**
 * POST /api/cron/message-email-digests
 *
 * Processes LinkedIn-style delayed message notification emails.
 * Protect with CRON_SECRET (Vercel Cron sends Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}

async function runCron(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'CRON_SECRET is required in production' },
      { status: 503 },
    );
  }

  try {
    const result = await processDueMessageEmailDigests(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/message-email-digests]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 },
    );
  }
}
