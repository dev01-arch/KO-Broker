import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyPortalToken } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';

const VerifyTokenSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
    }

    const parsed = VerifyTokenSchema.safeParse(body);
    if (!parsed.success) return applyCorsHeaders(req, apiFromZodError(parsed.error));

    const result = await verifyPortalToken(parsed.data.token);
    if ('error' in result) {
      return applyCorsHeaders(req, apiNotFound('Invalid or expired invite token'));
    }

    return applyCorsHeaders(req, apiSuccess(result));
  } catch (error) {
    console.error('[POST /api/portal/verify-token]', error);
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
