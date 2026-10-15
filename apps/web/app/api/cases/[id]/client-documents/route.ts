/**
 * POST /api/cases/:id/client-documents
 * Emails one firm template to the client and files it on the case.
 * Research and ESIS stay unavailable until those templates are in the library.
 */

import { NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { isClientTemplateId } from '@/lib/documents/client-templates';
import { sendCaseClientDocument } from '@/lib/documents/send-client-document';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Request body must be JSON', 422);
    }

    const template = body && typeof body === 'object' && 'template' in body ? String(body.template) : '';
    if (!isClientTemplateId(template)) {
      return apiError('VALIDATION_ERROR', 'Unknown client document', 422);
    }

    const result = await sendCaseClientDocument({
      orgId,
      caseId: id,
      template,
      userId: user?.id,
      origin: req.nextUrl.origin,
    });

    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND' ? 404 : result.code === 'DELIVERY_FAILED' ? 502 : 422;
      return apiError(result.code, result.message, status);
    }

    return apiSuccess({ template: result.template, documentName: result.documentName, sent: true });
  } catch (error) {
    console.error('[POST /api/cases/:id/client-documents]', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
