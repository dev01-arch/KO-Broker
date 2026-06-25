import { NextRequest } from 'next/server';
import { SendMessageSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { listMessagesForOrg, sendMessageForOrg } from '@/lib/api/messages-data';
import { orgHasFeature } from '@/lib/api/plan-access';
import { apiError, apiFromZodError, apiPlanLimitExceeded, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    if (!(await orgHasFeature(orgId, 'messages'))) {
      return apiPlanLimitExceeded('Messages require a Professional or Enterprise plan');
    }

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '25') || 25));
    const caseId = searchParams.get('caseId')?.trim();
    const clientId = searchParams.get('clientId')?.trim();
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const { total, messages } = await listMessagesForOrg(orgId, {
      page,
      perPage,
      caseId,
      clientId,
      unreadOnly,
    });

    return apiSuccess(messages, { meta: { total, page, perPage } });
  } catch (error) {
    console.error('[GET /api/messages]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    if (!(await orgHasFeature(orgId, 'messages'))) {
      return apiPlanLimitExceeded('Messages require a Professional or Enterprise plan');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await sendMessageForOrg(orgId, parsed.data);

    return apiSuccess(result.primary, {
      status: 201,
      meta: { delivery: result.delivery },
    });
  } catch (error) {
    console.error('[POST /api/messages]', error);
    if (isPrismaConnectionError(error))
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
