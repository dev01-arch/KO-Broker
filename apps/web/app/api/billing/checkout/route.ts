import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createHandler } from '@/lib/api/handler';
import { CheckoutSchema } from '@ko/types';
import { prisma } from '@/lib/db';
import {
  buildCheckoutLineItems,
  isMissingStripeCustomerError,
  stripeConfigured,
  type CheckoutPlan,
} from '@/lib/billing/stripe-checkout';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock-key', {
  apiVersion: '2026-06-24.dahlia',
});

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for upgrading an organization's plan.
 * Backend createHandler shape + frontend stripe-checkout helpers (stale customer retry, URLs).
 */
export const POST = createHandler({
  method: 'POST',
  schema: CheckoutSchema,
  handler: async (req: NextRequest, { body, user, orgId }) => {
    const { plan, successUrl, cancelUrl } = body;

    // === FRONTEND ADDITION: require real Stripe config + line-item builder ===
    if (!stripeConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Stripe is not configured. Add STRIPE_SECRET_KEY (sk_test_...) to your environment.',
          },
        },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const org = await prisma.organisation.findUnique({
      where: { id: orgId! },
    });

    if (!org) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Organisation not found' } },
        { status: 404 }
      );
    }

    let customerId = org.stripeCustomerId;

    const createCustomer = async () => {
      const customer = await stripe.customers.create({
        email: user?.email,
        name: org.name,
        metadata: { orgId: org.id },
      });
      await prisma.organisation.update({
        where: { id: org.id },
        data: { stripeCustomerId: customer.id },
      });
      return customer.id;
    };

    if (!customerId) {
      try {
        customerId = await createCustomer();
      } catch (err) {
        console.error('[Stripe Checkout] Failed to create customer:', err);
      }
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: buildCheckoutLineItems(plan as CheckoutPlan),
      mode: 'subscription',
      success_url: successUrl || `${appUrl}/dashboard/settings?billing=success&section=billing`,
      cancel_url: cancelUrl || `${appUrl}/dashboard/settings?billing=cancel&section=billing`,
      metadata: { orgId: org.id, plan },
      subscription_data: {
        metadata: { orgId: org.id, plan },
      },
    };

    if (customerId) {
      sessionConfig.customer = customerId;
    } else {
      sessionConfig.customer_email = user?.email;
    }

    try {
      const session = await stripe.checkout.sessions.create(sessionConfig);
      return NextResponse.json(
        {
          success: true,
          data: {
            url: session.url,
            checkoutUrl: session.url,
            sessionId: session.id,
            plan,
          },
        },
        { status: 200 }
      );
    } catch (err) {
      if (customerId && isMissingStripeCustomerError(err)) {
        console.warn(
          `[Stripe Checkout] Stripe customer ${customerId} not found for org ${org.id}; recreating.`,
        );
        await prisma.organisation.update({
          where: { id: org.id },
          data: { stripeCustomerId: null },
        });

        try {
          customerId = await createCustomer();
          sessionConfig.customer = customerId;
          delete sessionConfig.customer_email;
          const retrySession = await stripe.checkout.sessions.create(sessionConfig);
          return NextResponse.json(
            {
              success: true,
              data: {
                url: retrySession.url,
                checkoutUrl: retrySession.url,
                sessionId: retrySession.id,
                plan,
              },
            },
            { status: 200 }
          );
        } catch (retryErr) {
          console.error('[Stripe Checkout] Retry after stale customer failed:', retryErr);
          return NextResponse.json(
            {
              success: false,
              error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate checkout session' },
            },
            { status: 500 }
          );
        }
      }

      console.error('[Stripe Checkout] Failed to create session:', err);
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate checkout session' },
        },
        { status: 500 }
      );
    }
    // === END FRONTEND ADDITION ===
  },
});
