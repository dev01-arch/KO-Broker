import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isRestrictedAdviser } from '@/lib/auth/adviser-scope';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { getSurveyReportForOrg } from '@/lib/reports/survey-report-data';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;
    const currentUser = await getCurrentUser();
    const report = await getSurveyReportForOrg(orgId, req.nextUrl.searchParams.get('asOf'), {
      restrictToAdviserUserId: isRestrictedAdviser(currentUser) && currentUser ? currentUser.id : undefined,
    });
    return apiSuccess(report);
  } catch (error) {
    console.error('[GET /api/reports/survey]', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
