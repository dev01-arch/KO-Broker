import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { syncSubscriptionToOrg } from '@/lib/billing/subscription-sync';
import { cancelOtherSubscriptions } from '@/lib/billing/subscription-change';

type OrgPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock-key', {
  apiVersion: '2026-06-24.dahlia',
});

/**
 * POST /api/webhooks/stripe
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.warn('[Stripe Webhook] Missing stripe-signature header');
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
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

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        await syncSubscriptionToOrg(await stripe.subscriptions.retrieve(subscriptionId));
        if (customerId) await cancelOtherSubscriptions(stripe, customerId, subscriptionId);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await syncSubscriptionToOrg(event.data.object as Stripe.Subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      await syncSubscriptionToOrg(event.data.object as Stripe.Subscription, { deleted: true });
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const ref = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof ref === 'string' ? ref : ref?.id;
      if (subscriptionId) {
        await syncSubscriptionToOrg(await stripe.subscriptions.retrieve(subscriptionId));
      }
      break;
    }

    default:
      console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
  }
}
