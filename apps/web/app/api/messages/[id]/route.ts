import { NextRequest } from 'next/server';
import { MarkMessageReadSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { markMessageReadForOrg } from '@/lib/api/messages-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;
    const { id } = await context.params;

    let body: unknown = { isRead: true };
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = MarkMessageReadSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await markMessageReadForOrg(orgId, id, parsed.data.isRead);
    if (!result) return apiNotFound('Message not found');

    return apiSuccess(result);
  } catch (error) {
    console.error('[PATCH /api/messages/:id]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
