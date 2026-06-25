import { NextRequest } from 'next/server';
import { AdvanceStageSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { advanceCaseStage } from '@/lib/api/compliance-data';
import { serializeCaseSummary } from '@/lib/api/cases';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = AdvanceStageSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await advanceCaseStage(
      orgId,
      parsed.data.caseId,
      parsed.data.targetStage,
      user.id,
      parsed.data.notes,
    );

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return apiNotFound('Case not found');
      const details = 'details' in result && Array.isArray(result.details) ? result.details : undefined;
      return apiError(
        'BUSINESS_RULE_VIOLATION',
        'message' in result ? (result.message ?? 'Stage transition not allowed') : 'Stage transition not allowed',
        422,
        { details },
      );
    }

    return apiSuccess(serializeCaseSummary(result.case));
  } catch (error) {
    console.error('[POST /api/compliance/advance]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
