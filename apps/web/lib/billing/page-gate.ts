import { getCurrentUser } from '@/lib/auth';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import {
  getOrgAccess,
  grantComplimentaryIfAllowlisted,
  paywallEnabled,
  verifiedClerkEmails,
} from '@/lib/billing/org-access';
import type { OrgAccess } from '@/lib/billing/access-rules';

/**
 * Billing access for the signed-in user's org, for server components.
 * Returns null when the paywall is off or the user/org cannot be resolved yet
 * (the client-side auth guard and API routes handle those cases).
 */
export async function getPageOrgAccess(): Promise<OrgAccess | null> {
  if (!paywallEnabled()) return null;
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return null;
    await grantComplimentaryIfAllowlisted({
      orgId: user.orgId,
      role: user.role,
      verifiedEmails: await verifiedClerkEmails(),
    });
    return await getOrgAccess(user.orgId);
  } catch (error) {
    if (isPrismaConnectionError(error)) return null;
    throw error;
  }
}
