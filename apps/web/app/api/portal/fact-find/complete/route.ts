import { NextRequest } from 'next/server';
import { UpsertFactFindSchema } from '@ko/types';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { updatePortalFactFind } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    let payload: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        payload = (await req.json()) as Record<string, unknown>;
      } catch {
        return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
      }
    }

    const parsed = UpsertFactFindSchema.safeParse({ ...payload, markComplete: true });
    if (!parsed.success) {
      return applyCorsHeaders(req, apiFromZodError(parsed.error));
    }

    const saved = await updatePortalFactFind(authResult.session, parsed.data);
    if ('error' in saved) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }
    return applyCorsHeaders(req, apiSuccess(saved));
  } catch (error) {
    console.error('[POST /api/portal/fact-find/complete]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
