import { NextRequest } from 'next/server';
import { RegenerateSectionSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { regenerateReportSection } from '@/lib/api/ai-data';
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

    const parsed = RegenerateSectionSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await regenerateReportSection(
      orgId,
      parsed.data.reportId,
      parsed.data.sectionId,
      {
        adviserContext: parsed.data.adviserContext,
        userId: user.id,
      },
    );

    if ('error' in result) {
      if (result.error === 'SERVICE_UNAVAILABLE') {
        return apiError(
          'SERVICE_UNAVAILABLE',
          'message' in result ? result.message : 'AI service unavailable',
          503,
        );
      }
      if (result.error === 'BUSINESS_RULE_VIOLATION') {
        return apiError(
          'BUSINESS_RULE_VIOLATION',
          'message' in result ? result.message : 'Cannot regenerate section',
          422,
        );
      }
      return apiNotFound(
        'message' in result && result.message ? result.message : 'Report not found',
      );
    }

    return apiSuccess(result.report);
  } catch (error) {
    console.error('[POST /api/ai/regenerate-section]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (message.includes('OpenRouter') || message.includes('AI response')) {
      return apiError('INTERNAL_ERROR', message, 502);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
