/**
 * GET /api/compliance
 *
 * Platform-wide compliance overview for the authenticated organisation:
 * KPIs, stage distribution, per-case progress, advisory flags, and firm document library.
 * Does not mutate cases or change stage-gate behaviour.
 */

import { getCurrentUser } from '@/lib/auth';
import { isRestrictedAdviser } from '@/lib/auth/adviser-scope';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getComplianceOverviewForOrg } from '@/lib/api/compliance-overview-data';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const currentUser = await getCurrentUser();
    const data = await getComplianceOverviewForOrg(orgId, {
      restrictToAdviserUserId:
        isRestrictedAdviser(currentUser) && currentUser ? currentUser.id : undefined,
    });

    return apiSuccess(data);
  } catch (error) {
    console.error('[GET /api/compliance]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
