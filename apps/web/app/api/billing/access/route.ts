import Stripe from 'stripe';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { prisma } from '@/lib/db';
import { stripeConfigured, isMissingStripeCustomerError } from '@/lib/billing/stripe-checkout';
import {
  getOrgAccess,
  grantComplimentaryIfAllowlisted,
  invalidateOrgAccess,
  paywallEnabled,
  verifiedClerkEmails,
} from '@/lib/billing/org-access';
import { pickPrimarySubscription, syncSubscriptionToOrg } from '@/lib/billing/subscription-sync';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock-key', {
  apiVersion: '2026-06-24.dahlia',
});

async function accessPayload(orgId: string, role: string) {
  const access = await getOrgAccess(orgId);
  return { ...access, paywallEnabled: paywallEnabled(), isAdmin: role === 'ADMIN' };
}

/**
 * GET /api/billing/access — whether the signed-in user's organisation may use the app.
 */
export async function GET() {
  try {
    const authResult = await requireApiAuth({ allowUnpaid: true });
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;

    await grantComplimentaryIfAllowlisted({
      orgId,
      role: user.role,
      verifiedEmails: paywallEnabled() ? await verifiedClerkEmails() : [],
    });
    return apiSuccess(await accessPayload(orgId, user.role));
  } catch (error) {
    console.error('[GET /api/billing/access]', error);
    if (isPrismaConnectionError(error)) return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

/**
 * POST /api/billing/access — re-reads the subscription from Stripe (used right after checkout,
 * so access does not wait for the webhook), then returns the access state.
 */
export async function POST() {
  try {
    const authResult = await requireApiAuth({ allowUnpaid: true });
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;

    if (paywallEnabled() && stripeConfigured()) {
      const org = await prisma.organisation.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      });
      if (org?.stripeCustomerId) {
        try {
          const list = await stripe.subscriptions.list({
            customer: org.stripeCustomerId,
            status: 'all',
            limit: 10,
          });
          const subscription = pickPrimarySubscription(list.data);
          if (subscription) await syncSubscriptionToOrg(subscription);
        } catch (stripeError) {
          if (!isMissingStripeCustomerError(stripeError)) throw stripeError;
        }
      }
      invalidateOrgAccess(orgId);
    }

    return apiSuccess(await accessPayload(orgId, user.role));
  } catch (error) {
    console.error('[POST /api/billing/access]', error);
    if (isPrismaConnectionError(error)) return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
