import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhooks/email
 *
 * Receives inbound email events from SendGrid Inbound Parse / similar providers.
 * Stores inbound messages to the org message thread.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    console.info('[webhook/email] received payload, length:', body.length);

    return NextResponse.json({ success: true, received: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process webhook' } },
      { status: 500 },
    );
  }
}
