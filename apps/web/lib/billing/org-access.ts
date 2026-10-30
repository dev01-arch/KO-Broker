import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import {
  computeOrgAccess,
  isComplimentaryEmail,
  parsePaywallStart,
  type BillingPlan,
  type OrgAccess,
} from '@/lib/billing/access-rules';

const CACHE_TTL_MS = 15_000;
const accessCache = new Map<string, { value: OrgAccess; expiresAt: number }>();

export function paywallStartsAt(): Date | null {
  return parsePaywallStart(process.env.BILLING_PAYWALL_STARTS_AT);
}

export function paywallEnabled(): boolean {
  return paywallStartsAt() !== null;
}

export function invalidateOrgAccess(orgId?: string) {
  if (orgId) accessCache.delete(orgId);
  else accessCache.clear();
}

/**
 * Billing access for an org. With the paywall off this never reads the new billing
 * columns, so it is safe before the migration has been applied.
 */
export async function getOrgAccess(orgId: string): Promise<OrgAccess> {
  const startsAt = paywallStartsAt();
  if (!startsAt) {
    return { allowed: true, reason: 'paywall_off', effectivePlan: 'STARTER', subscribedPlan: 'STARTER', trialEndsAt: null };
  }

  const cached = accessCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: {
        plan: true,
        createdAt: true,
        accessGrant: true,
        trialEndsAt: true,
        subscriptionStatus: true,
      },
    });
    if (!org) {
      return { allowed: false, reason: 'trial_ended', effectivePlan: 'STARTER', subscribedPlan: 'STARTER', trialEndsAt: null };
    }
    const value = computeOrgAccess({ ...org, plan: org.plan as BillingPlan }, { paywallStartsAt: startsAt });
    accessCache.set(orgId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    // Local development without a database runs on the in-memory dev store; never paywall it.
    if (process.env.NODE_ENV === 'development' && isPrismaConnectionError(error)) {
      return { allowed: true, reason: 'paywall_off', effectivePlan: 'ENTERPRISE', subscribedPlan: 'STARTER', trialEndsAt: null };
    }
    throw error;
  }
}

/** Verified email addresses of the signed-in Clerk user. */
export async function verifiedClerkEmails(): Promise<string[]> {
  const clerkUser = await currentUser();
  return (clerkUser?.emailAddresses ?? [])
    .filter((address) => address.verification?.status === 'verified')
    .map((address) => address.emailAddress);
}

export function complimentaryAllowlist() {
  return {
    domains: process.env.COMPLIMENTARY_EMAIL_DOMAINS,
    emails: process.env.COMPLIMENTARY_EMAILS,
  };
}

/**
 * Marks the org COMPLIMENTARY when an org admin has a verified allowlisted email.
 * Admin-only so an allowlisted person invited into a customer's org does not make it free.
 */
export async function grantComplimentaryIfAllowlisted(input: {
  orgId: string;
  role: string;
  verifiedEmails: string[];
}): Promise<boolean> {
  if (!paywallEnabled() || input.role !== 'ADMIN') return false;
  const allowlist = complimentaryAllowlist();
  if (!input.verifiedEmails.some((email) => isComplimentaryEmail(email, allowlist))) return false;

  const result = await prisma.organisation.updateMany({
    where: { id: input.orgId, accessGrant: 'NONE' },
    data: { accessGrant: 'COMPLIMENTARY' },
  });
  if (result.count > 0) invalidateOrgAccess(input.orgId);
  return result.count > 0;
}
