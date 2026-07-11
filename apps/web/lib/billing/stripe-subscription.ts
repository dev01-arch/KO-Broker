import Stripe from 'stripe';
import { stripeConfigured } from '@/lib/billing/stripe-checkout';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'mock-key', {
  apiVersion: '2026-06-24.dahlia',
});

export type BillingSubscriptionStatus = {
  hasSubscription: boolean;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

export async function getBillingSubscriptionForCustomer(
  customerId: string,
): Promise<BillingSubscriptionStatus> {
  if (!stripeConfigured()) {
    return {
      hasSubscription: false,
      status: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });

  const activeSubscription =
    subscriptions.data.find((subscription) =>
      ['active', 'trialing', 'past_due'].includes(subscription.status),
    ) ?? null;

  if (!activeSubscription) {
    return {
      hasSubscription: false,
      status: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    };
  }

  // API 2025+: current_period_end lives on SubscriptionItem, not Subscription
  const periodEnd = activeSubscription.items.data[0]?.current_period_end;

  return {
    hasSubscription: true,
    status: activeSubscription.status,
    cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
    currentPeriodEnd: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  };
}
