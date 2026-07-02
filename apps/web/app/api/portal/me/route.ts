import { NextRequest } from 'next/server';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { getPortalSessionProfile } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const profile = await getPortalSessionProfile(authResult.session);
    if ('error' in profile) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }

    return applyCorsHeaders(req, apiSuccess(profile));
  } catch (error) {
    console.error('[GET /api/portal/me]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
