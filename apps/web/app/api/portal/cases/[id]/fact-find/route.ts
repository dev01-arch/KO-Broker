import { NextRequest } from 'next/server';
import { UpsertFactFindSchema } from '@ko/types';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { getCaseForOrg, upsertFactFindForCase } from '@/lib/api/cases-data';
import { serializeFactFind } from '@/lib/api/cases';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const { session } = authResult;
    const { id } = await context.params;

    const caseRecord = await getCaseForOrg(session.orgId, id);
    if (!caseRecord || caseRecord.client.id !== session.clientId) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
    }

    const parsed = UpsertFactFindSchema.safeParse(body);
    if (!parsed.success) {
      return applyCorsHeaders(req, apiFromZodError(parsed.error));
    }

    const result = await upsertFactFindForCase(session.orgId, id, parsed.data);
    if ('error' in result) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }

    return applyCorsHeaders(req, apiSuccess(serializeFactFind(result.factFind)));
  } catch (error) {
    console.error('[PUT /api/portal/cases/:id/fact-find]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
