import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getCurrentUser } from '@/lib/auth';
import { getOrgProfile } from '@/lib/api/settings-data';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

/** Returns the signed-in user's org plan, role, and visibility for UI gating (§1, §4). */
export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;
    const visibilityUser = await getCurrentUser();

    const profile = await getOrgProfile(orgId, {
      role: visibilityUser?.role ?? user.role,
      canViewAllClients: visibilityUser?.canViewAllClients,
      canViewAccountDetails: visibilityUser?.canViewAccountDetails,
      canViewAiSummaries: visibilityUser?.canViewAiSummaries,
    });
    if (!profile) return apiNotFound('Organisation not found');

    return apiSuccess(profile);
  } catch (error) {
    console.error('[GET /api/settings/org]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
