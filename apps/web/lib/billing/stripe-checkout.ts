import Stripe from 'stripe';

export type CheckoutPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type StripeBillingTier = CheckoutPlan;
export type StripeBillingInterval = 'monthly' | 'yearly';

/** Monthly amounts in pence; yearly is 10× (two months free). Used only when no price ID is configured. */
const PLAN_AMOUNTS: Record<CheckoutPlan, number> = {
  STARTER: 3500,
  PROFESSIONAL: 5000,
  ENTERPRISE: 7500,
};

const PLAN_LABELS: Record<CheckoutPlan, string> = {
  STARTER: 'KO Platform Starter',
  PROFESSIONAL: 'KO Platform Professional',
  ENTERPRISE: 'KO Platform Enterprise',
};

const STRIPE_PRICE_ENV_KEYS: Record<
  StripeBillingTier,
  Record<StripeBillingInterval, string[]>
> = {
  STARTER: {
    monthly: ['STRIPE_PRICE_STARTER_MONTHLY'],
    yearly: ['STRIPE_PRICE_STARTER_YEARLY'],
  },
  PROFESSIONAL: {
    monthly: ['STRIPE_PRICE_PROFESSIONAL_MONTHLY', 'STRIPE_PRICE_PROFESSIONAL'],
    yearly: ['STRIPE_PRICE_PROFESSIONAL_YEARLY'],
  },
  ENTERPRISE: {
    monthly: ['STRIPE_PRICE_ENTERPRISE_MONTHLY', 'STRIPE_PRICE_ENTERPRISE'],
    yearly: ['STRIPE_PRICE_ENTERPRISE_YEARLY'],
  },
};

function isConfiguredPriceId(priceId: string | undefined): priceId is string {
  return Boolean(priceId && !priceId.startsWith('price_dummy') && priceId !== 'price_');
}

export function getStripePriceId(
  tier: StripeBillingTier,
  interval: StripeBillingInterval = 'monthly',
): string | undefined {
  for (const envKey of STRIPE_PRICE_ENV_KEYS[tier][interval]) {
    const priceId = process.env[envKey];
    if (isConfiguredPriceId(priceId)) return priceId;
  }
  return undefined;
}

export function getPlanFromStripePriceId(priceId: string): StripeBillingTier | null {
  const tiers: StripeBillingTier[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
  const intervals: StripeBillingInterval[] = ['monthly', 'yearly'];

  for (const tier of tiers) {
    for (const interval of intervals) {
      if (getStripePriceId(tier, interval) === priceId) return tier;
    }
  }

  return null;
}

export function buildCheckoutLineItems(
  plan: CheckoutPlan,
  interval: StripeBillingInterval = 'monthly',
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const envPriceId = getStripePriceId(plan, interval);

  if (envPriceId) {
    return [{ price: envPriceId, quantity: 1 }];
  }

  const yearly = interval === 'yearly';
  return [
    {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: PLAN_LABELS[plan],
          description: yearly ? 'Per adviser, per year' : 'Per adviser, per month',
        },
        unit_amount: yearly ? PLAN_AMOUNTS[plan] * 10 : PLAN_AMOUNTS[plan],
        recurring: { interval: yearly ? 'year' : 'month' },
      },
      quantity: 1,
    },
  ];
}

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && key.startsWith('sk_'));
}

/**
 * True when a Stripe API call failed because the referenced customer id
 * doesn't exist for the current STRIPE_SECRET_KEY (e.g. the customer was
 * created under a different Stripe account/mode, or the account switched
 * from test to live keys). Callers should treat this as "no billing
 * account" and clear the stale id rather than surfacing a 500.
 */
export function isMissingStripeCustomerError(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === 'resource_missing' &&
    error.param === 'customer'
  );
}
