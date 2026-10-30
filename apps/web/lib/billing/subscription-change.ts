import type Stripe from 'stripe';
import {
  getStripePriceId,
  type CheckoutPlan,
  type StripeBillingInterval,
} from '@/lib/billing/stripe-checkout';
import { syncSubscriptionToOrg } from '@/lib/billing/subscription-sync';

const CHANGEABLE_STATUSES = new Set(['active', 'trialing']);

export type SubscriptionChangeResult =
  | { kind: 'none' }
  | { kind: 'changed'; subscriptionId: string }
  | { kind: 'error'; status: number; code: string; message: string };

/**
 * If the customer already has a live subscription, switch it to the requested plan instead of
 * creating a second one. The price difference is invoiced immediately; if that payment fails
 * the change is not applied (Stripe `pending_if_incomplete`).
 */
export async function changeExistingSubscription(
  stripe: Stripe,
  input: { customerId: string; orgId: string; plan: CheckoutPlan; interval: StripeBillingInterval },
): Promise<SubscriptionChangeResult> {
  const list = await stripe.subscriptions.list({ customer: input.customerId, status: 'all', limit: 10 });
  const current = list.data.find((subscription) => CHANGEABLE_STATUSES.has(subscription.status));
  if (!current) return { kind: 'none' };

  const item = current.items.data[0];
  const priceId = getStripePriceId(input.plan, input.interval);
  if (!item || !priceId) {
    return {
      kind: 'error',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: `No Stripe price is configured for ${input.plan} (${input.interval}). Set the STRIPE_PRICE_* environment variables.`,
    };
  }
  if (item.price.id === priceId) {
    return { kind: 'error', status: 409, code: 'CONFLICT', message: 'Your organisation is already on this plan.' };
  }

  const updated = await stripe.subscriptions.update(current.id, {
    items: [{ id: item.id, price: priceId }],
    proration_behavior: 'always_invoice',
    payment_behavior: 'pending_if_incomplete',
  });
  if (updated.pending_update) {
    return {
      kind: 'error',
      status: 402,
      code: 'PAYMENT_FAILED',
      message:
        'The payment for this plan change did not go through, so your plan was not changed. Update your payment method in billing settings and try again.',
    };
  }

  const withMetadata = await stripe.subscriptions.update(current.id, {
    metadata: { ...current.metadata, orgId: input.orgId, plan: input.plan },
  });
  await syncSubscriptionToOrg(withMetadata);
  return { kind: 'changed', subscriptionId: current.id };
}

/** After a new checkout, cancel any other open subscriptions for the customer so they are never billed twice. */
export async function cancelOtherSubscriptions(stripe: Stripe, customerId: string, keepSubscriptionId: string) {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  const stale = list.data.filter(
    (subscription) =>
      subscription.id !== keepSubscriptionId &&
      !['canceled', 'incomplete_expired'].includes(subscription.status),
  );
  for (const subscription of stale) {
    await stripe.subscriptions.cancel(subscription.id, { prorate: true });
    console.warn(`[Billing] Cancelled duplicate subscription ${subscription.id} for customer ${customerId}.`);
  }
}
