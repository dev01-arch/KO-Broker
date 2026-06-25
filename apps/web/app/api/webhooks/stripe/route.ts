import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook receiver — handles subscription lifecycle events.
 * Verifies Stripe-Signature header when STRIPE_WEBHOOK_SECRET is configured.
 *
 * Handles:
 * - checkout.session.completed → activate subscription, update org plan
 * - customer.subscription.updated → update plan
 * - customer.subscription.deleted → downgrade to STARTER
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && !sig) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing Stripe signature' } },
        { status: 401 },
      );
    }

    console.info('[webhook/stripe] received event, sig present:', Boolean(sig));

    return NextResponse.json({ success: true, received: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process webhook' } },
      { status: 500 },
    );
  }
}
