import { NextRequest } from 'next/server';
import { AuthError, requireVisibility } from '@/lib/auth';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { approveAiReportForOrg } from '@/lib/api/ai-data';
import { apiBusinessRuleViolation, apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;
    const { id } = await context.params;

    try {
      await requireVisibility('canViewAiSummaries');
    } catch (error) {
      if (error instanceof AuthError) {
        return apiError(error.code, error.message, error.statusCode);
      }
      throw error;
    }

    const result = await approveAiReportForOrg(orgId, id, user.id);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return apiNotFound('Report not found');
      if (result.error === 'BUSINESS_RULE_VIOLATION') {
        return apiBusinessRuleViolation(result.message, result.details);
      }
      return apiError('INTERNAL_ERROR', 'Could not approve report', 500);
    }

    return apiSuccess(result.report);
  } catch (error) {
    console.error('[POST /api/ai/reports/:id/approve]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
