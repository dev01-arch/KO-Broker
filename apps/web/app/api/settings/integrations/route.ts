import { NextRequest } from 'next/server';
import { UpdateIntegrationsSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getOrgIntegrations, updateOrgIntegrations } from '@/lib/api/settings-data';
import { apiError, apiFromZodError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

function maskSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(value.length - 8, 12))}${value.slice(-4)}`;
}

function maskIntegrations(integrations: Awaited<ReturnType<typeof getOrgIntegrations>>) {
  return {
    equifax: {
      apiKey: maskSecret(integrations.equifax?.apiKey),
      enabled: integrations.equifax?.enabled ?? false,
    },
    twilio: {
      accountSid: integrations.twilio?.accountSid,
      authToken: maskSecret(integrations.twilio?.authToken),
      enabled: integrations.twilio?.enabled ?? false,
    },
  };
}

export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    const integrations = await getOrgIntegrations(orgId);
    return apiSuccess(maskIntegrations(integrations));
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
      return apiError('FORBIDDEN', 'Admin role required to update integration settings', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = UpdateIntegrationsSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const updated = await updateOrgIntegrations(orgId, parsed.data);
    return apiSuccess(maskIntegrations(updated));
  } catch (error) {
    console.error('[PUT /api/settings/integrations]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
