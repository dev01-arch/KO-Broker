import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { CheckoutSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiFromZodError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { prisma } from '@/lib/db';
import {
  buildCheckoutLineItems,
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
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { user, orgId } = authResult;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const { plan, successUrl, cancelUrl } = parsed.data;

    if (!stripeConfigured()) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'Stripe is not configured. Add STRIPE_SECRET_KEY (sk_test_...) to your environment.',
        503,
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return apiError('NOT_FOUND', 'Organisation not found', 404);
    }

    let customerId = org.stripeCustomerId;

    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: org.name,
          metadata: { orgId: org.id },
        });
        customerId = customer.id;

        await prisma.organisation.update({
          where: { id: org.id },
          data: { stripeCustomerId: customerId },
        });
      } catch (err) {
        console.error('[Stripe Checkout] Failed to create customer:', err);
      }
    }

    try {
      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: buildCheckoutLineItems(plan as CheckoutPlan),
        mode: 'subscription',
        success_url: successUrl || `${appUrl}/dashboard/settings?billing=success&section=billing`,
        cancel_url: cancelUrl || `${appUrl}/dashboard/settings?billing=cancel&section=billing`,
        metadata: {
          orgId: org.id,
          plan,
        },
        subscription_data: {
          metadata: {
            orgId: org.id,
            plan,
          },
        },
      };

      if (customerId) {
        sessionConfig.customer = customerId;
      } else {
        sessionConfig.customer_email = user.email;
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      return apiSuccess({
        url: session.url!,
        checkoutUrl: session.url!,
        sessionId: session.id,
        plan,
      });
    } catch (err) {
      console.error('[Stripe Checkout] Failed to create session:', err);
      return apiError('INTERNAL_ERROR', 'Failed to initiate checkout session', 500);
    }
  } catch (error) {
    console.error('[POST /api/billing/checkout]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
