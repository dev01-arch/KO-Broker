import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { prisma } from '@/lib/db';
import { stripeConfigured } from '@/lib/billing/stripe-checkout';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock-key', {
  apiVersion: '2026-06-24.dahlia',
});

/**
 * POST /api/billing/portal
 *
 * Opens Stripe Customer Portal for subscription management (cancel, payment method, invoices).
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { user, orgId } = authResult;

    if (user.role !== 'ADMIN') {
      return apiError('FORBIDDEN', 'Only admins can manage billing', 403);
    }

    if (!stripeConfigured()) {
      return apiError(
        'SERVICE_UNAVAILABLE',
        'Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.',
        503,
      );
    }

    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true },
    });

    if (!org?.stripeCustomerId) {
      return apiError(
        'NOT_FOUND',
        'No billing account found. Complete a checkout first to create a Stripe customer.',
        404,
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${appUrl}/dashboard/settings?section=billing`,
      });

      return apiSuccess({ url: session.url });
    } catch (err) {
      console.error('[Stripe Portal] Failed to create session:', err);
      return apiError(
        'SERVICE_UNAVAILABLE',
        'Could not open Stripe billing portal. Enable the Customer Portal in your Stripe Dashboard (Settings → Billing → Customer portal).',
        503,
      );
    }
  } catch (error) {
    console.error('[POST /api/billing/portal]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
