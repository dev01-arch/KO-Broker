/**
 * GET  /api/messages  — list messages (org-scoped, filterable by caseId/clientId)
 * POST /api/messages  — create a new message and deliver via digest scheduling
 *
 * Uses requireApiAuth (same as dashboard bootstrap / settings/org) instead of
 * createHandler auth — the poll-hot GET path was 503'ing inside resolveAuth
 * before the handler ran.
 */

import { NextRequest } from 'next/server';
import { SendMessageSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { getCurrentUser } from '@/lib/auth';
import {
  caseAssignedToAdviserWhere,
  clientAssignedToAdviserWhere,
  isRestrictedAdviser,
} from '@/lib/auth/adviser-scope';
import { listMessagesForOrg, sendMessageForOrg } from '@/lib/api/messages-data';
import { orgHasFeature } from '@/lib/api/plan-access';
import { apiError, apiFromZodError, apiPlanLimitExceeded, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError, isPrismaMissingColumnError } from '@/lib/api/prisma-errors';
import { logAuditEvent } from '@/lib/compliance/audit';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '25') || 25));
  const caseId = searchParams.get('caseId')?.trim();
  const clientId = searchParams.get('clientId')?.trim();
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) {
      // Polling: treat auth-layer DB outage as empty inbox, not a hard 503
      if (authResult.response.status === 503) {
        console.warn('[GET /api/messages] auth DB blip — returning empty page');
        return apiSuccess([], { meta: { total: 0, page, perPage } });
      }
      return authResult.response;
    }
    const { orgId } = authResult;
    const currentUser = await getCurrentUser();

    if (!(await orgHasFeature(orgId, 'messages'))) {
      return apiPlanLimitExceeded('Messages require a Professional or Enterprise plan');
    }

    const { total, messages } = await listMessagesForOrg(orgId, {
      page,
      perPage,
      caseId,
      clientId,
      unreadOnly,
      restrictToAdviserUserId:
        isRestrictedAdviser(currentUser) && currentUser ? currentUser.id : undefined,
    });

    return apiSuccess(messages, { meta: { total, page, perPage } });
  } catch (error) {
    console.error('[GET /api/messages]', error);
    // Polling endpoint: brief DB/schema blips should not hard-fail the dashboard
    if (isPrismaConnectionError(error) || isPrismaMissingColumnError(error)) {
      console.warn('[GET /api/messages] DB blip — returning empty page');
      return apiSuccess([], { meta: { total: 0, page, perPage } });
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;

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

    const currentUser = await getCurrentUser();
    if (isRestrictedAdviser(currentUser) && currentUser) {
      const { caseId, clientId } = parsed.data;
      if (caseId) {
        const allowedCase = await prisma.case.findFirst({
          where: {
            id: caseId,
            orgId,
            ...caseAssignedToAdviserWhere(currentUser.id),
          },
          select: { id: true },
        });
        if (!allowedCase) {
          return apiError('FORBIDDEN', 'You can only message clients assigned to you.', 403);
        }
      } else if (clientId) {
        const allowedClient = await prisma.client.findFirst({
          where: {
            id: clientId,
            orgId,
            ...clientAssignedToAdviserWhere(currentUser.id),
          },
          select: { id: true },
        });
        if (!allowedClient) {
          return apiError('FORBIDDEN', 'You can only message clients assigned to you.', 403);
        }
      }
    }

    const result = await sendMessageForOrg(orgId, parsed.data, { invitingUserId: user.id });

    if (parsed.data.caseId) {
      try {
        await logAuditEvent({
          orgId,
          userId: user.id,
          entityType: 'Message',
          entityId: parsed.data.caseId,
          action: 'MESSAGE_SENT',
          diff: {
            after: { channel: parsed.data.channel, sourceType: parsed.data.sourceType },
          },
        });
      } catch (auditError) {
        console.warn('[POST /api/messages] audit log failed — message was sent', auditError);
      }
    }

    return apiSuccess(result.primary, {
      status: 201,
      meta: { delivery: result.delivery },
    });
  } catch (error) {
    console.error('[POST /api/messages]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
