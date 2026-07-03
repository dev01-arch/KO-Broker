import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

type OrgPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock-key', {
  apiVersion: '2026-06-24.dahlia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getPlanFromPriceId(priceId: string): OrgPlan {
  const profPrice = process.env.STRIPE_PRICE_PROFESSIONAL;
  const entPrice = process.env.STRIPE_PRICE_ENTERPRISE;

  if (priceId === profPrice) return 'PROFESSIONAL';
  if (priceId === entPrice) return 'ENTERPRISE';
  return 'STARTER';
}

/**
 * POST /api/webhooks/stripe
 */
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    console.warn('[Stripe Webhook] Received webhook without validation (no signature/secret)');

    if (!webhookSecret) {
      try {
        const event = JSON.parse(body) as Stripe.Event;
        await handleEvent(event);
        return NextResponse.json({ received: true });
      } catch {
        return new Response('Invalid JSON payload', { status: 400 });
      }
    }
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stripe Webhook] Signature verification failed: ${msg}`);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  await handleEvent(event);

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  console.log(`[Stripe Webhook] Processing event type: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const plan = session.metadata?.plan as OrgPlan;
      const customerId = session.customer as string;

      if (orgId && plan) {
        await prisma.organisation.update({
          where: { id: orgId },
          data: {
            plan,
            stripeCustomerId: customerId,
          },
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price.id;

      if (customerId && priceId) {
        const plan = getPlanFromPriceId(priceId);
        const org = await prisma.organisation.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (org) {
          await prisma.organisation.update({
            where: { id: org.id },
            data: { plan },
          });
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      if (customerId) {
        const org = await prisma.organisation.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (org) {
          await prisma.organisation.update({
            where: { id: org.id },
            data: { plan: 'STARTER' },
          });
        }
      }
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}
