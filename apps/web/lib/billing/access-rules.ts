/**
 * Paywall rules (pure — no DB or Stripe calls, so they can be unit tested).
 *
 * The paywall is off unless BILLING_PAYWALL_STARTS_AT is set. When it is on:
 * - COMPLIMENTARY orgs (allowlisted emails) get Enterprise for free.
 * - Orgs created before the start date, or marked GRANDFATHERED, get Enterprise for free.
 * - A Stripe subscription that is `active` or `trialing` gets the plan it pays for.
 * - Otherwise a new org gets an Enterprise trial for TRIAL_DAYS after creation.
 * - Anything else (trial over, payment failed, cancelled) is blocked.
 */

export type BillingPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type OrgAccessGrant = 'NONE' | 'COMPLIMENTARY' | 'GRANDFATHERED';

export const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_STATUSES = new Set(['active', 'trialing']);
const FAILED_PAYMENT_STATUSES = new Set(['past_due', 'unpaid', 'incomplete', 'paused']);

export type OrgAccessReason =
  | 'paywall_off'
  | 'complimentary'
  | 'grandfathered'
  | 'subscribed'
  | 'trial'
  | 'trial_ended'
  | 'payment_failed'
  | 'canceled';

export interface OrgBillingRow {
  plan: BillingPlan;
  createdAt: Date;
  accessGrant?: OrgAccessGrant | null;
  trialEndsAt?: Date | null;
  subscriptionStatus?: string | null;
}

export interface OrgAccess {
  allowed: boolean;
  reason: OrgAccessReason;
  /** Plan used for feature gates. */
  effectivePlan: BillingPlan;
  /** Plan stored on the org (what Stripe last reported). */
  subscribedPlan: BillingPlan;
  trialEndsAt: string | null;
}

export function parsePaywallStart(value: string | undefined | null): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

export function trialEndFor(org: Pick<OrgBillingRow, 'createdAt' | 'trialEndsAt'>): Date {
  return org.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS);
}

export function computeOrgAccess(
  org: OrgBillingRow,
  options: { paywallStartsAt: Date | null; now?: Date },
): OrgAccess {
  const now = options.now ?? new Date();
  const base = { subscribedPlan: org.plan, trialEndsAt: null as string | null };

  if (!options.paywallStartsAt) {
    return { ...base, allowed: true, reason: 'paywall_off', effectivePlan: org.plan };
  }
  if (org.accessGrant === 'COMPLIMENTARY') {
    return { ...base, allowed: true, reason: 'complimentary', effectivePlan: 'ENTERPRISE' };
  }
  if (org.accessGrant === 'GRANDFATHERED' || org.createdAt < options.paywallStartsAt) {
    return { ...base, allowed: true, reason: 'grandfathered', effectivePlan: 'ENTERPRISE' };
  }

  const status = org.subscriptionStatus ?? null;
  if (status && PAID_STATUSES.has(status)) {
    return { ...base, allowed: true, reason: 'subscribed', effectivePlan: org.plan };
  }

  const trialEnd = trialEndFor(org);
  if (trialEnd > now) {
    return {
      ...base,
      allowed: true,
      reason: 'trial',
      effectivePlan: 'ENTERPRISE',
      trialEndsAt: trialEnd.toISOString(),
    };
  }

  const reason: OrgAccessReason =
    status && FAILED_PAYMENT_STATUSES.has(status)
      ? 'payment_failed'
      : status === 'canceled' || status === 'incomplete_expired'
        ? 'canceled'
        : 'trial_ended';
  return {
    ...base,
    allowed: false,
    reason,
    effectivePlan: org.plan,
    trialEndsAt: trialEnd.toISOString(),
  };
}

function parseList(value: string | undefined | null): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Exact address match, or exact domain match (no subdomains). */
export function isComplimentaryEmail(
  email: string | null | undefined,
  config: { domains?: string | null; emails?: string | null },
): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return false;
  if (parseList(config.emails).includes(normalized)) return true;
  const domain = normalized.slice(normalized.lastIndexOf('@') + 1);
  return parseList(config.domains).map((d) => d.replace(/^@/, '')).includes(domain);
}
