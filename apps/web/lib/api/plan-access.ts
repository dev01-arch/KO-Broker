import { canAccessFeature, type Plan } from '@ko/types';
import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { getOrgAccess, paywallEnabled } from '@/lib/billing/org-access';

function shouldUseDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

/** Plan feature gates are always on once the paywall is enabled. */
export function planLimitsEnforced(): boolean {
  return paywallEnabled() || process.env.KO_ENFORCE_PLAN_LIMITS === 'true';
}

export async function getOrgPlan(orgId: string): Promise<Plan> {
  try {
    const org = await prisma.organisation.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });
    return (org?.plan ?? 'STARTER') as Plan;
  } catch (error) {
    if (shouldUseDevStore(error)) {
      return devStore.getOrg(orgId)?.plan ?? 'STARTER';
    }
    throw error;
  }
}

export async function orgHasFeature(orgId: string, feature: string): Promise<boolean> {
  if (!planLimitsEnforced()) {
    return true;
  }
  const plan = paywallEnabled() ? (await getOrgAccess(orgId)).effectivePlan : await getOrgPlan(orgId);
  return canAccessFeature(plan, feature);
}
