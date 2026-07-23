import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getCurrentUser } from '@/lib/auth';
import { getDashboardBootstrap } from '@/lib/api/dashboard-data';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

/** Returns org profile + clients + cases + advisers in one round trip for the dashboard. */
export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const visibilityUser = await getCurrentUser();
    const data = await getDashboardBootstrap(orgId, {
      id: visibilityUser?.id ?? user.id,
      role: visibilityUser?.role ?? user.role,
      canViewAllClients: visibilityUser?.canViewAllClients,
      canViewAccountDetails: visibilityUser?.canViewAccountDetails,
      canViewAiSummaries: visibilityUser?.canViewAiSummaries,
    });

    if (!data.org) return apiNotFound('Organisation not found');

    return apiSuccess({
      org: data.org,
      clients: data.clients,
      cases: data.cases,
      advisers: data.advisers,
    });
  } catch (error) {
    console.error('[GET /api/dashboard/bootstrap]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
