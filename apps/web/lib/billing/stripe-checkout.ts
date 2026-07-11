import Stripe from 'stripe';

export type CheckoutPlan = 'PROFESSIONAL' | 'ENTERPRISE';
export type StripeBillingTier = 'STARTER' | CheckoutPlan;
export type StripeBillingInterval = 'monthly' | 'yearly';

const PLAN_AMOUNTS: Record<CheckoutPlan, number> = {
  PROFESSIONAL: 5000,
  ENTERPRISE: 7500,
};

const PLAN_LABELS: Record<CheckoutPlan, string> = {
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
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const envPriceId = getStripePriceId(plan, 'monthly');

  if (envPriceId) {
    return [{ price: envPriceId, quantity: 1 }];
  }

  return [
    {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: PLAN_LABELS[plan],
          description: 'Per adviser, per month',
        },
        unit_amount: PLAN_AMOUNTS[plan],
        recurring: { interval: 'month' },
      },
      quantity: 1,
    },
  ];
}

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && key.startsWith('sk_'));
}
