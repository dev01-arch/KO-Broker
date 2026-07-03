import { NextRequest } from 'next/server';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { completePortalFactFind } from '@/lib/api/fact-find-data';
import { serializeFactFind } from '@/lib/api/cases';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const result = await completePortalFactFind(authResult.session);
    if ('error' in result) {
      if ('message' in result && result.message) {
        return applyCorsHeaders(req, apiNotFound(result.message));
      }
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }

    return applyCorsHeaders(req, apiSuccess(serializeFactFind(result.factFind)));
  } catch (error) {
    console.error('[POST /api/portal/fact-find/complete]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
