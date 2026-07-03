import { NextRequest } from 'next/server';
import { UpsertFactFindSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { upsertFactFindWithCompliance } from '@/lib/api/fact-find-data';
import { serializeFactFind } from '@/lib/api/cases';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, context: RouteContext) {
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

    const parsed = UpsertFactFindSchema.safeParse(body);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }

    const result = await upsertFactFindWithCompliance(orgId, id, parsed.data, {
      userId: user.id,
      allowWhenComplete: true,
    });
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return apiNotFound('Case not found');
      if (result.error === 'FORBIDDEN') {
        return apiError(
          'FORBIDDEN',
          'message' in result ? (result.message as string) : 'Fact-find cannot be edited',
          403,
        );
      }
      return apiNotFound('Case not found');
    }

    return apiSuccess({
      factFind: serializeFactFind(result.factFind),
      client: 'client' in result ? result.client : undefined,
    });
  } catch (error) {
    console.error('[PUT /api/cases/:id/fact-find]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
