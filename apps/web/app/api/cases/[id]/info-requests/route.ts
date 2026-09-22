/**
 * GET  /api/cases/:id/info-requests — list all info requests for a case
 * POST /api/cases/:id/info-requests — create a new info request and send the message
 *
 * PRD-16 W5. A "request from client" sends a message via the existing PRD-10
 * broadcast path and creates a ClientInfoRequest row that stays OUTSTANDING until
 * a matching document is uploaded or the adviser marks the checklist item complete.
 *
 * No DELETE or PATCH endpoints — status transitions are side-effects of
 * document upload and compliance item completion.
 */

import { NextRequest } from 'next/server';
import { CreateInfoRequestSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import {
  createInfoRequestForCase,
  listInfoRequestsForCase,
  serializeInfoRequest,
} from '@/lib/api/info-requests-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;

    const result = await listInfoRequestsForCase(orgId, id);
    if ('error' in result) return apiNotFound('Case not found');

    return apiSuccess(result.requests.map(serializeInfoRequest));
  } catch (error) {
    console.error('[GET /api/cases/:id/info-requests]', error);
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

    const parsed = CreateInfoRequestSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await createInfoRequestForCase(orgId, id, parsed.data, user.id);
    if ('error' in result) return apiNotFound('Case not found');

    return apiSuccess(
      {
        infoRequest: serializeInfoRequest(result.infoRequest),
        delivery: result.delivery,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/cases/:id/info-requests]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
