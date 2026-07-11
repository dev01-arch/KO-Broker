import type { Plan } from '@ko/types';

export type PricingTierId = 'starter' | 'professional' | 'enterprise';

export type PricingTier = {
  id: PricingTierId;
  plan: Plan;
  name: string;
  price: string;
  v2Design: 'starter' | 'professional' | 'enterprise';
  features: string[];
  mostPopular?: boolean;
  checkoutPlan?: 'PROFESSIONAL' | 'ENTERPRISE';
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    plan: 'STARTER',
    name: 'Starter',
    price: '35',
    v2Design: 'starter',
    features: [
      'Core CRM & Pipeline',
      'Compliance Engine',
      'All 8 Calculators',
      'Basic Integrations',
    ],
  },
  {
    id: 'professional',
    plan: 'PROFESSIONAL',
    name: 'Professional',
    price: '50',
    v2Design: 'professional',
    mostPopular: true,
    checkoutPlan: 'PROFESSIONAL',
    features: [
      'Everything in Starter',
      'Messages & Notifications',
      'AI Report Generation',
      'Client Portal',
      'Advanced Reporting',
    ],
  },
  {
    id: 'enterprise',
    plan: 'ENTERPRISE',
    name: 'Enterprise',
    price: '75',
    v2Design: 'enterprise',
    checkoutPlan: 'ENTERPRISE',
    features: [
      'Everything in Pro',
      'Full AI Intelligence Suite',
      'Lender API Submissions',
      'Custom Domain',
    ],
  },
];

export const PLAN_ORDER: Record<Plan, number> = {
  STARTER: 0,
  PROFESSIONAL: 1,
  ENTERPRISE: 2,
};

export function formatPlanLabel(plan: Plan): string {
  return PRICING_TIERS.find((tier) => tier.plan === plan)?.name ?? plan;
}
