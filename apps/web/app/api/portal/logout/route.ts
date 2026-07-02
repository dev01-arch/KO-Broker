import { NextRequest } from 'next/server';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { applyCorsHeaders } from '@/lib/api/cors';
import { clearPortalSessionCookieOptions } from '@/lib/api/portal-session';
import { apiError, apiSuccess } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const cookie = clearPortalSessionCookieOptions();
    const res = apiSuccess({ success: true });
    res.cookies.set(cookie);
    return applyCorsHeaders(req, res);
  } catch (error) {
    console.error('[POST /api/portal/logout]', error);
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
