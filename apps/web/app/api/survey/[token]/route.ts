/**
 * Public feedback survey. The token in the link is the only credential.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api/responses';
import { FEEDBACK_QUESTIONS } from '@/lib/survey/feedback-survey';
import { readSurveyInvite, saveSurveyResponse } from '@/lib/survey/survey-store';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (!token) return apiError('NOT_FOUND', 'This survey link is not valid.', 404);
    const invite = await readSurveyInvite(token);
    if ('error' in invite && invite.error) {
      const expired = invite.error === 'EXPIRED';
      return apiError(invite.error, expired ? 'This survey link has expired.' : 'This survey link is not valid.', expired ? 410 : 404);
    }
    return apiSuccess({
      firmName: invite.firmName,
      firstName: invite.firstName,
      lastName: invite.lastName,
      submitted: invite.submitted,
      questions: FEEDBACK_QUESTIONS,
    });
  } catch (error) {
    console.error('[GET /api/survey/:token]', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    if (!token) return apiError('NOT_FOUND', 'This survey link is not valid.', 404);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Request body must be JSON', 422);
    }
    const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const answers = source.answers && typeof source.answers === 'object'
      ? Object.fromEntries(Object.entries(source.answers as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
      : {};
    const comment = typeof source.comment === 'string' ? source.comment : '';
    const saved = await saveSurveyResponse(token, answers, comment);
    if (!saved.ok) return apiError('VALIDATION_ERROR', saved.message, 422);
    return apiSuccess({ submitted: true, alreadySubmitted: saved.alreadySubmitted });
  } catch (error) {
    console.error('[POST /api/survey/:token]', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
