import { NextRequest } from 'next/server';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { getCaseForOrg } from '@/lib/api/cases-data';
import { serializeCaseDetail } from '@/lib/api/cases';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const { session } = authResult;
    const { id } = await context.params;

    const caseRecord = await getCaseForOrg(session.orgId, id);
    if (!caseRecord || caseRecord.client.id !== session.clientId) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }

    return applyCorsHeaders(req, apiSuccess(serializeCaseDetail(caseRecord)));
  } catch (error) {
    console.error('[GET /api/portal/cases/:id]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
