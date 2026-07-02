import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import { listPortalMessages, sendPortalMessage } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';
import {
  apiError,
  apiFromZodError,
  apiSuccess,
} from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

const SendMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required'),
});

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const messages = await listPortalMessages(authResult.session);
    return applyCorsHeaders(req, apiSuccess(messages));
  } catch (error) {
    console.error('[GET /api/portal/messages]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
    }

    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) return applyCorsHeaders(req, apiFromZodError(parsed.error));

    const message = await sendPortalMessage(authResult.session, parsed.data.body);
    return applyCorsHeaders(req, apiSuccess(message, { status: 201 }));
  } catch (error) {
    console.error('[POST /api/portal/messages]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
