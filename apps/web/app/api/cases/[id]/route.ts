import { NextRequest } from 'next/server';
import { UpdateCaseSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getCurrentUser, maskCaseFinancials, maskClientFinancials } from '@/lib/auth';
import { caseAssignedToAdviserWhere, isRestrictedAdviser } from '@/lib/auth/adviser-scope';
import { getCaseForOrg, updateCaseForOrg } from '@/lib/api/cases-data';
import { serializeCaseDetail, serializeCaseSummary } from '@/lib/api/cases';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { prisma } from '@/lib/db';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    const isAdviserWithRestriction = isRestrictedAdviser(currentUser);
    const hideAccountDetails =
      currentUser?.role === 'ADVISER' && !currentUser.canViewAccountDetails;

    const caseRecord = await getCaseForOrg(orgId, id);
    if (!caseRecord) {
      return apiNotFound('Case not found');
    }

    if (isAdviserWithRestriction && currentUser) {
      const allowed = await prisma.case.findFirst({
        where: {
          id,
          orgId,
          ...caseAssignedToAdviserWhere(currentUser.id),
        },
        select: { id: true },
      });
      if (!allowed) {
        return apiNotFound('Case not found');
      }
    }

    let payload = serializeCaseDetail(caseRecord);
    if (hideAccountDetails) {
      payload = maskCaseFinancials(payload);
      if (payload.client) {
        payload = { ...payload, client: maskClientFinancials(payload.client) };
      }
    }

    return apiSuccess(payload);
  } catch (error) {
    console.error('[GET /api/cases/:id]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;
    const currentUser = await getCurrentUser();
    const isAdviserWithRestriction = isRestrictedAdviser(currentUser);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = UpdateCaseSchema.safeParse(body);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }

    if (isAdviserWithRestriction && currentUser) {
      const allowed = await prisma.case.findFirst({
        where: {
          id,
          orgId,
          ...caseAssignedToAdviserWhere(currentUser.id),
        },
        select: { id: true },
      });
      if (!allowed) {
        return apiNotFound('Case not found');
      }
    }

    const result = await updateCaseForOrg(orgId, id, parsed.data);
    if ('error' in result) {
      if (result.error === 'BUSINESS_RULE_VIOLATION') {
        const message =
          'message' in result && result.message
            ? result.message
            : 'Business rule violation';
        return apiError('BUSINESS_RULE_VIOLATION', message, 422);
      }
      const message =
        'message' in result && result.message ? result.message : 'Case not found';
      return apiNotFound(message);
    }

    return apiSuccess(serializeCaseSummary(result.case));
  } catch (error) {
    console.error('[PATCH /api/cases/:id]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
