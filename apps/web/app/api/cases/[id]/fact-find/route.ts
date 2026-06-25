import { NextRequest } from 'next/server';
import { UpsertFactFindSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { upsertFactFindForCase } from '@/lib/api/cases-data';
import { serializeFactFind } from '@/lib/api/cases';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = UpsertFactFindSchema.safeParse(body);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }

    const result = await upsertFactFindForCase(orgId, id, parsed.data);
    if ('error' in result) {
      return apiNotFound('Case not found');
    }

    return apiSuccess(serializeFactFind(result.factFind));
  } catch (error) {
    console.error('[PUT /api/cases/:id/fact-find]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
