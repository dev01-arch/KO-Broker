import type Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { isPrismaMissingColumnError } from '@/lib/api/prisma-errors';
import { getPlanFromStripePriceId } from '@/lib/billing/stripe-checkout';
import { invalidateOrgAccess } from '@/lib/billing/org-access';

type OrgPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
const PLANS: OrgPlan[] = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
const LIVE_STATUSES = new Set(['active', 'trialing']);

/** The price being paid wins; metadata covers inline (price_data) prices that have no configured ID. */
function planForSubscription(subscription: Stripe.Subscription): OrgPlan | null {
  const priceId = subscription.items.data[0]?.price.id;
  const pricePlan = priceId ? getPlanFromStripePriceId(priceId) : null;
  if (pricePlan) return pricePlan;
  const metadataPlan = subscription.metadata?.plan as OrgPlan | undefined;
  if (metadataPlan && PLANS.includes(metadataPlan)) return metadataPlan;
  return priceId ? 'STARTER' : null;
}

function customerIdOf(subscription: Stripe.Subscription): string | null {
  const customer = subscription.customer;
  if (!customer) return null;
  return typeof customer === 'string' ? customer : customer.id;
}

async function findOrgForSubscription(subscription: Stripe.Subscription) {
  const metadataOrgId = subscription.metadata?.orgId;
  if (metadataOrgId) {
    const org = await prisma.organisation.findUnique({ where: { id: metadataOrgId }, select: { id: true } });
    if (org) return org.id;
  }
  const customerId = customerIdOf(subscription);
  if (!customerId) return null;
  const org = await prisma.organisation.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return org?.id ?? null;
}

/**
 * Saves a subscription's plan + status onto its org.
 * `deleted` mirrors the original webhook: the plan drops back to STARTER.
 */
export async function syncSubscriptionToOrg(
  subscription: Stripe.Subscription,
  options: { deleted?: boolean } = {},
): Promise<string | null> {
  const orgId = await findOrgForSubscription(subscription);
  if (!orgId) return null;

  const status = options.deleted ? 'canceled' : subscription.status;
  const plan = options.deleted ? 'STARTER' : planForSubscription(subscription);
  const customerId = customerIdOf(subscription);
  const periodEnd = subscription.items.data[0]?.current_period_end;

  let currentSubscriptionId: string | null = null;
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    });
    currentSubscriptionId = org?.stripeSubscriptionId ?? null;
    // A late event for an older subscription must not override a newer live one.
    if (
      currentSubscriptionId &&
      currentSubscriptionId !== subscription.id &&
      !LIVE_STATUSES.has(status) &&
      org?.subscriptionStatus &&
      LIVE_STATUSES.has(org.subscriptionStatus)
    ) {
      return orgId;
    }
  } catch (error) {
    if (!isPrismaMissingColumnError(error)) throw error;
  }

  await prisma.organisation.update({
    where: { id: orgId },
    data: {
      ...(plan ? { plan } : {}),
      ...(customerId ? { stripeCustomerId: customerId } : {}),
    },
  });

  try {
    await prisma.organisation.update({
      where: { id: orgId },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: status,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });
  } catch (error) {
    // Billing columns not migrated yet: keep the plan sync working as before.
    if (!isPrismaMissingColumnError(error)) throw error;
    console.warn('[Billing] Subscription status not saved: run the billing_access migration.');
  }

  invalidateOrgAccess(orgId);
  return orgId;
}

/** Picks the subscription that should drive access: a live one first, else the newest. */
export function pickPrimarySubscription(subscriptions: Stripe.Subscription[]): Stripe.Subscription | null {
  if (subscriptions.length === 0) return null;
  const live = subscriptions.find((subscription) => LIVE_STATUSES.has(subscription.status));
  if (live) return live;
  return [...subscriptions].sort((a, b) => b.created - a.created)[0] ?? null;
}
