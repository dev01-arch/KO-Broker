/**
 * POST /api/compliance/items
 *
 * Marks a UI checklist item complete by writing a CHECKLIST:<itemId>
 * ComplianceRecord. Does not change Case.stage or run stage-gate checks.
 */

import { NextRequest } from 'next/server';
import { CompleteComplianceItemSchema } from '@ko/types';
import { getCurrentUser } from '@/lib/auth';
import { isRestrictedAdviser } from '@/lib/auth/adviser-scope';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { completeComplianceItemForOrg } from '@/lib/api/compliance-overview-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const currentUser = await getCurrentUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = CompleteComplianceItemSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await completeComplianceItemForOrg(
      orgId,
      parsed.data.caseId,
      parsed.data.itemId,
      currentUser?.id ?? user.id,
      {
        restrictToAdviserUserId:
          isRestrictedAdviser(currentUser) && currentUser ? currentUser.id : undefined,
      },
    );

    if ('error' in result) {
      if (result.error === 'VALIDATION_ERROR') {
        return apiError('VALIDATION_ERROR', result.message ?? 'Invalid checklist item', 422);
      }
      return apiNotFound('Case not found');
    }

    return apiSuccess(result);
  } catch (error) {
    console.error('[POST /api/compliance/items]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
