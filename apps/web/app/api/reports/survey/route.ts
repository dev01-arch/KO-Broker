import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isRestrictedAdviser } from '@/lib/auth/adviser-scope';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { getSurveyReportForOrg } from '@/lib/reports/survey-report-data';
import { reportDateRange, ReportRangeError } from '@/lib/reports/vulnerability-report';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;
    const params = req.nextUrl.searchParams;
    const range = reportDateRange({
      from: params.get('from'),
      to: params.get('to'),
      asOf: params.get('asOf'),
    });
    const currentUser = await getCurrentUser();
    const report = await getSurveyReportForOrg(orgId, range, {
      restrictToAdviserUserId: isRestrictedAdviser(currentUser) && currentUser ? currentUser.id : undefined,
    });
    return apiSuccess(report);
  } catch (error) {
    if (error instanceof ReportRangeError) {
      return apiError('VALIDATION_ERROR', error.message, 400);
    }
    console.error('[GET /api/reports/survey]', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
