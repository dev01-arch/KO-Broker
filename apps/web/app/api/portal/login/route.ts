import { NextRequest } from 'next/server';
import { z } from 'zod';
import { loginPortalClient } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';
import { portalSessionCookieOptions } from '@/lib/api/portal-session';
import { apiError, apiFromZodError, apiSuccess, apiUnauthorized } from '@/lib/api/responses';

const LoginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) return applyCorsHeaders(req, apiFromZodError(parsed.error));

    const result = await loginPortalClient(parsed.data.email, parsed.data.password);
    if ('error' in result) {
      return applyCorsHeaders(req, apiUnauthorized());
    }

    const cookie = portalSessionCookieOptions(result.sessionToken);
    const res = apiSuccess({ success: true, clientId: result.session.clientId });
    res.cookies.set(cookie);
    return applyCorsHeaders(req, res);
  } catch (error) {
    console.error('[POST /api/portal/login]', error);
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
