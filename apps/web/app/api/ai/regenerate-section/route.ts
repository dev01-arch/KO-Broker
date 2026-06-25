import { NextRequest } from 'next/server';
import { RegenerateSectionSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { regenerateReportSection } from '@/lib/api/ai-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = RegenerateSectionSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const regeneratedContent = parsed.data.adviserContext
      ? `Regenerated content for section "${parsed.data.sectionId}" (${parsed.data.adviserContext}) — powered by Azure AI Foundry.`
      : `Regenerated content for section "${parsed.data.sectionId}" — powered by Azure AI Foundry.`;

    const result = await regenerateReportSection(
      orgId,
      parsed.data.reportId,
      parsed.data.sectionId,
      regeneratedContent,
    );

    if (!result) return apiNotFound('Report not found');

    return apiSuccess(result);
  } catch (error) {
    console.error('[POST /api/ai/regenerate-section]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
