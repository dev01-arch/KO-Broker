/**
 * GET  /api/clients/:id/properties — list all properties for a client
 * POST /api/clients/:id/properties — create a new property on the client
 *
 * PRD-16 W3. Properties are org-scoped and client-owned.
 * No top-level nav item — properties only appear on the client detail
 * and as a pointer from a case.
 */

import { NextRequest } from 'next/server';
import { CreatePropertySchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import {
  createPropertyForClient,
  listPropertiesForClient,
  serializeProperty,
} from '@/lib/api/properties-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;

    const result = await listPropertiesForClient(orgId, id);
    if ('error' in result) return apiNotFound('Client not found');

    return apiSuccess(result.properties.map(serializeProperty));
  } catch (error) {
    console.error('[GET /api/clients/:id/properties]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = CreatePropertySchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await createPropertyForClient(orgId, id, parsed.data, user.id);
    if ('error' in result) return apiNotFound('Client not found');

    return apiSuccess(serializeProperty(result.property), { status: 201 });
  } catch (error) {
    console.error('[POST /api/clients/:id/properties]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
