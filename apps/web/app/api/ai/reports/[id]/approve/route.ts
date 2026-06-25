import { NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { approveAiReportForOrg } from '@/lib/api/ai-data';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;
    const { id } = await context.params;

    const result = await approveAiReportForOrg(orgId, id, user.id);
    if (!result) return apiNotFound('Report not found');

    return apiSuccess(result);
  } catch (error) {
    console.error('[POST /api/ai/reports/:id/approve]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
