/**
 * GET  /api/settings/integrations  — org Equifax / Twilio flags
 * PUT  /api/settings/integrations  — update (ADMIN only)
 *
 * Uses settings-data (equifax/twilio) — matches the Settings UI and @ko/types.
 */

import { NextRequest } from 'next/server';
import { UpdateIntegrationsSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getOrgIntegrations, updateOrgIntegrations } from '@/lib/api/settings-data';
import { apiError, apiFromZodError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { logAuditEvent } from '@/lib/compliance/audit';

export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    const integrations = await getOrgIntegrations(orgId);
    return apiSuccess(integrations);
  } catch (error) {
    console.error('[GET /api/settings/integrations]', error);
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
      return apiError('FORBIDDEN', 'Admin role required to update integrations', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = UpdateIntegrationsSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const before = await getOrgIntegrations(orgId);
    const updated = await updateOrgIntegrations(orgId, parsed.data);

    await logAuditEvent({
      orgId,
      userId: user.id,
      entityType: 'Organisation',
      entityId: orgId,
      action: 'INTEGRATION_SETTINGS_UPDATED',
      diff: {
        before: {
          equifaxEnabled: Boolean(before.equifax?.enabled),
          twilioEnabled: Boolean(before.twilio?.enabled),
        },
        after: {
          equifaxEnabled: Boolean(updated.equifax?.enabled),
          twilioEnabled: Boolean(updated.twilio?.enabled),
        },
      },
    });

    return apiSuccess(updated);
  } catch (error) {
    console.error('[PUT /api/settings/integrations]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
