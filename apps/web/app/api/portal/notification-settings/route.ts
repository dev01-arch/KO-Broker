import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePortalAuth } from '@/lib/api/require-portal-auth';
import {
  getPortalNotificationSettings,
  updatePortalNotificationSettings,
} from '@/lib/api/client-notification-prefs';
import { applyCorsHeaders } from '@/lib/api/cors';
import {
  apiError,
  apiFromZodError,
  apiNotFound,
  apiSuccess,
} from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

const PatchSchema = z
  .object({
    emailMessages: z.boolean().optional(),
    inAppMessages: z.boolean().optional(),
  })
  .refine(
    (value) =>
      typeof value.emailMessages === 'boolean' || typeof value.inAppMessages === 'boolean',
    { message: 'At least one preference is required' },
  );

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    const settings = await getPortalNotificationSettings(authResult.session);
    return applyCorsHeaders(req, apiSuccess(settings));
  } catch (error) {
    console.error('[GET /api/portal/notification-settings]', error);
    if (error instanceof Error && error.message === 'CLIENT_NOT_FOUND') {
      return applyCorsHeaders(req, apiNotFound('Client not found'));
    }
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requirePortalAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
    }

    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) return applyCorsHeaders(req, apiFromZodError(parsed.error));

    const settings = await updatePortalNotificationSettings(
      authResult.session,
      parsed.data,
    );
    return applyCorsHeaders(req, apiSuccess(settings));
  } catch (error) {
    console.error('[PATCH /api/portal/notification-settings]', error);
    if (error instanceof Error && error.message === 'CLIENT_NOT_FOUND') {
      return applyCorsHeaders(req, apiNotFound('Client not found'));
    }
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
