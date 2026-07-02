import { NextRequest } from 'next/server';
import { UpsertFactFindSchema } from '@ko/types';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { getPortalFactFind, updatePortalFactFind } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const factFind = await getPortalFactFind(authResult.session);
    if (factFind && 'error' in factFind) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }
    return applyCorsHeaders(req, apiSuccess(factFind));
  } catch (error) {
    console.error('[GET /api/portal/fact-find]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

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

    const saved = await updatePortalFactFind(authResult.session, parsed.data);
    if ('error' in saved) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }
    return applyCorsHeaders(req, apiSuccess(saved));
  } catch (error) {
    console.error('[PUT /api/portal/fact-find]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
