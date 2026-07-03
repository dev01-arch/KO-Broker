import { NextRequest } from 'next/server';
import { GenerateReportSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { createAiReportForOrg } from '@/lib/api/ai-data';
import { orgHasFeature } from '@/lib/api/plan-access';
import { apiError, apiFromZodError, apiNotFound, apiPlanLimitExceeded, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;

    if (!(await orgHasFeature(orgId, 'ai_reports'))) {
      return apiPlanLimitExceeded('AI Suitability Reports require a Professional or Enterprise plan');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = GenerateReportSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await createAiReportForOrg(orgId, {
      caseId: parsed.data.caseId,
      templateType: parsed.data.templateType,
      generatedBy: user.id,
    });

    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return apiNotFound('Case not found');
      if (result.error === 'BUSINESS_RULE_VIOLATION') {
        return apiError(
          'BUSINESS_RULE_VIOLATION',
          'message' in result ? (result.message as string) : 'Preconditions not met',
          422,
        );
      }
      return apiNotFound('Case not found');
    }

    return apiSuccess(result.report, { status: 201 });
  } catch (error) {
    console.error('[POST /api/ai/generate-report]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
