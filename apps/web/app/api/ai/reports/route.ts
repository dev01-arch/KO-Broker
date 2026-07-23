import { NextRequest } from 'next/server';
import { AuthError, getCurrentUser, requireVisibility } from '@/lib/auth';
import { isRestrictedAdviser } from '@/lib/auth/adviser-scope';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { listAiReportsForOrg } from '@/lib/api/ai-data';
import { orgHasFeature } from '@/lib/api/plan-access';
import { apiError, apiPlanLimitExceeded, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    try {
      await requireVisibility('canViewAiSummaries');
    } catch (error) {
      if (error instanceof AuthError) {
        return apiError(error.code, error.message, error.statusCode);
      }
      throw error;
    }

    if (!(await orgHasFeature(orgId, 'ai_reports'))) {
      return apiPlanLimitExceeded('AI Suitability Reports require a Professional or Enterprise plan');
    }

    const currentUser = await getCurrentUser();
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '25') || 25));
    const caseId = searchParams.get('caseId')?.trim();

    const { total, reports } = await listAiReportsForOrg(orgId, {
      page,
      perPage,
      caseId,
      restrictToAdviserUserId:
        isRestrictedAdviser(currentUser) && currentUser ? currentUser.id : undefined,
    });

    return apiSuccess(reports, { meta: { total, page, perPage } });
  } catch (error) {
    console.error('[GET /api/ai/reports]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
