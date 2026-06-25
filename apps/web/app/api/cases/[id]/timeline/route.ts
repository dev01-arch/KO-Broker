import { NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { listTimelineForCase } from '@/lib/api/timeline-data';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;
    const { id } = await context.params;

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '50') || 50));

    const result = await listTimelineForCase(orgId, id, { page, perPage });
    if (!result) return apiNotFound('Case not found');

    return apiSuccess(result.entries, { meta: { total: result.total, page, perPage } });
  } catch (error) {
    console.error('[GET /api/cases/:id/timeline]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
