import { NextRequest } from 'next/server';
import { UpdateMessagingSettingsSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getOrgMessagingSettings, updateOrgMessagingSettings } from '@/lib/api/settings-data';
import { apiError, apiFromZodError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    const messaging = await getOrgMessagingSettings(orgId);
    return apiSuccess(messaging);
  } catch (error) {
    console.error('[GET /api/settings/messaging]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;

    if (user.role !== 'ADMIN') {
      return apiError('FORBIDDEN', 'Admin role required to update messaging settings', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = UpdateMessagingSettingsSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const updated = await updateOrgMessagingSettings(orgId, parsed.data);
    return apiSuccess(updated);
  } catch (error) {
    console.error('[PUT /api/settings/messaging]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
