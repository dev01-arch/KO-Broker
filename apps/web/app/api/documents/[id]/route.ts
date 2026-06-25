import { NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getDocumentForOrg, deleteDocumentForOrg } from '@/lib/api/documents-data';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;
    const { id } = await context.params;

    const doc = await getDocumentForOrg(orgId, id);
    if (!doc) return apiNotFound('Document not found');

    return apiSuccess(doc);
  } catch (error) {
    console.error('[GET /api/documents/:id]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;
    const { id } = await context.params;

    const deleted = await deleteDocumentForOrg(orgId, id);
    if (!deleted) return apiNotFound('Document not found');

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('[DELETE /api/documents/:id]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
