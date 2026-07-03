import { NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getDocumentForOrg, deleteDocumentForOrg } from '@/lib/api/documents-data';
import { refreshSignedUrl } from '@/lib/storage/r2';
import { logAuditEvent } from '@/lib/compliance/audit';
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

    const freshUrl = await refreshSignedUrl(doc.storageUrl);

    return apiSuccess({ ...doc, storageUrl: freshUrl });
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
    const { orgId, user } = authResult;
    const { id } = await context.params;

    const existing = await getDocumentForOrg(orgId, id);
    if (!existing) return apiNotFound('Document not found');

    const deleted = await deleteDocumentForOrg(orgId, id);
    if (!deleted) return apiNotFound('Document not found');

    await logAuditEvent({
      orgId,
      userId: user.id,
      entityType: 'Document',
      entityId: existing.caseId ?? existing.clientId ?? id,
      action: 'DOCUMENT_DELETED',
      diff: {
        before: {
          documentId: id,
          name: existing.name,
          documentType: existing.documentType,
        },
      },
    });

    return apiSuccess({ id });
  } catch (error) {
    console.error('[DELETE /api/documents/:id]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
