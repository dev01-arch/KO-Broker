/**
 * POST /api/cases/:id/illustrations
 * Builds the ESIS or research pack from the case and files the PDF.
 * Sending is a separate action.
 */

import { NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { generateCaseIllustration, type IllustrationKind } from '@/lib/documents/generate-illustration';

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
    const kind = body && typeof body === 'object' && 'kind' in body ? String(body.kind) : '';
    if (kind !== 'esis' && kind !== 'research') {
      return apiError('VALIDATION_ERROR', 'Choose an ESIS or a research pack', 422);
    }

    const result = await generateCaseIllustration({
      orgId,
      caseId: id,
      kind: kind as IllustrationKind,
      userId: user?.id,
      deliver: false,
    });
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 422;
      return apiError(result.code, result.message, status);
    }
    return apiSuccess({ kind, documentName: result.documentName, sent: false });
  } catch (error) {
    console.error('[POST /api/cases/:id/illustrations]', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
