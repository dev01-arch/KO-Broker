import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { prisma } from '@/lib/db';
import { stripeConfigured } from '@/lib/billing/stripe-checkout';
import { getBillingSubscriptionForCustomer } from '@/lib/billing/stripe-subscription';

/**
 * GET /api/billing/subscription
 */
export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;

    if (!stripeConfigured()) {
      return apiSuccess({
        hasBillingAccount: false,
        hasSubscription: false,
        status: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      });
    }

    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true, plan: true },
    });

    if (!org?.stripeCustomerId) {
      return apiSuccess({
        hasBillingAccount: false,
        hasSubscription: false,
        status: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      });
    }

    const subscription = await getBillingSubscriptionForCustomer(org.stripeCustomerId);
    return apiSuccess({
      hasBillingAccount: true,
      ...subscription,
    });
  } catch (error) {
    console.error('[GET /api/billing/subscription]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
