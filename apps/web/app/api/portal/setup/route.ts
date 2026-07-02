import { NextRequest } from 'next/server';
import { z } from 'zod';
import { setupPortalAccount } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';
import { portalSessionCookieOptions } from '@/lib/api/portal-session';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';

const SetupSchema = z.object({
  token: z.string().min(1, 'token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
    }

    const parsed = SetupSchema.safeParse(body);
    if (!parsed.success) return applyCorsHeaders(req, apiFromZodError(parsed.error));

    const result = await setupPortalAccount(parsed.data.token, parsed.data.password);
    if ('error' in result) {
      return applyCorsHeaders(req, apiNotFound('Invalid or expired invite token'));
    }

    const cookie = portalSessionCookieOptions(result.sessionToken);
    const res = apiSuccess({
      success: true,
      clientId: result.session.clientId,
      sessionToken: result.sessionToken,
    });
    res.cookies.set(cookie);
    return applyCorsHeaders(req, res);
  } catch (error) {
    console.error('[POST /api/portal/setup]', error);
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
