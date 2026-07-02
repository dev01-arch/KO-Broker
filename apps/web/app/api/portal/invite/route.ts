import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { inviteClientToPortal } from '@/lib/api/portal-data';
import { orgHasFeature } from '@/lib/api/plan-access';
import { applyCorsHeaders } from '@/lib/api/cors';
import {
  apiError,
  apiFromZodError,
  apiNotFound,
  apiPlanLimitExceeded,
  apiSuccess,
} from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

const InviteSchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return applyCorsHeaders(req, authResult.response);
    const { orgId } = authResult;

    if (!(await orgHasFeature(orgId, 'client_portal'))) {
      return applyCorsHeaders(req, apiPlanLimitExceeded('Client portal requires a Professional or Enterprise plan'));
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyCorsHeaders(req, apiError('VALIDATION_ERROR', 'Invalid JSON body', 422));
    }

    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) return applyCorsHeaders(req, apiFromZodError(parsed.error));

    const result = await inviteClientToPortal(orgId, parsed.data.caseId);
    if ('error' in result) {
      return applyCorsHeaders(req, apiNotFound('Case not found'));
    }

    return applyCorsHeaders(
      req,
      apiSuccess(
        {
          message: result.notifications.email === 'sent'
            ? 'Onboarding invitation sent successfully.'
            : `Portal invite created but email could not be sent. ${result.emailError ?? 'Check server logs and Resend domain settings.'}`,
        },
        { status: 201, meta: { notifications: result.notifications } },
      ),
    );
  } catch (error) {
    console.error('[POST /api/portal/invite]', error);
    if (isPrismaConnectionError(error)) {
      return applyCorsHeaders(req, apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503));
    }
    return applyCorsHeaders(req, apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500));
  }
}
