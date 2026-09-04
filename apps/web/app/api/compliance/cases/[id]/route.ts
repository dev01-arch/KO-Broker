/**
 * GET /api/compliance/cases/[id]
 *
 * Evaluated 16-item compliance checklist for a single case.
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isRestrictedAdviser } from '@/lib/auth/adviser-scope';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getCaseComplianceForOrg } from '@/lib/api/compliance-overview-data';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;
    const currentUser = await getCurrentUser();

    const result = await getCaseComplianceForOrg(orgId, id, {
      restrictToAdviserUserId:
        isRestrictedAdviser(currentUser) && currentUser ? currentUser.id : undefined,
    });

    if ('error' in result) return apiNotFound('Case not found');
    return apiSuccess(result);
  } catch (error) {
    console.error('[GET /api/compliance/cases/:id]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
