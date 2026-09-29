import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getCurrentUser } from '@/lib/auth';
import { getDashboardPipeline } from '@/lib/api/dashboard-data';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

/** Slim case list for the overview kanban. Does not replace bootstrap. */
export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const visibilityUser = await getCurrentUser();
    const cases = await getDashboardPipeline(orgId, {
      id: visibilityUser?.id ?? user.id,
      role: visibilityUser?.role ?? user.role,
      canViewAllClients: visibilityUser?.canViewAllClients,
      canViewAccountDetails: visibilityUser?.canViewAccountDetails,
      canViewAiSummaries: visibilityUser?.canViewAiSummaries,
    });

    return apiSuccess(cases);
  } catch (error) {
    console.error('[GET /api/dashboard/pipeline]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
