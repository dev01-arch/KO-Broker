/**
 * GET  /api/clients  — paginated client list (org-scoped)
 * POST /api/clients  — create a new client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { logAuditEvent } from '@/lib/compliance/audit';
import { getCurrentUser, maskClientFinancials } from '@/lib/auth';
import {
  ClientCategoryFilterSchema,
  ClientStatusSchema,
  ClientTypeSchema,
  CreateClientSchema,
  EmploymentStatusSchema,
} from '@ko/types';
import { createClientForOrg, listClientsForOrg } from '@/lib/api/clients-data';
import { serializeClientSummary } from '@/lib/api/clients';

// ── GET /api/clients ──────────────────────────────────────────────────────────

export const GET = createHandler({
  method: 'GET',
  handler: async (req: NextRequest, { orgId }) => {
    // Advisers with canViewAllClients=false only see assigned clients.
    // ADMIN and advisers with the switch ON see all org clients.
    const currentUser = await getCurrentUser();
    const isAdviserWithRestriction =
      currentUser?.role === 'ADVISER' && !currentUser.canViewAllClients;
    const hideAccountDetails =
      currentUser?.role === 'ADVISER' && !currentUser.canViewAccountDetails;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') ?? '25', 10)));
    const search = searchParams.get('search') ?? undefined;
    const employmentStatusRaw = searchParams.get('employmentStatus') ?? undefined;
    // === FRONTEND ADDITION: company / referral / member filters ===
    const clientTypeRaw = searchParams.get('clientType') ?? undefined;
    const clientCategoryRaw = searchParams.get('clientCategory') ?? undefined;
    const statusRaw = searchParams.get('status') ?? undefined;
    const assignedMemberId = searchParams.get('assignedMemberId') ?? undefined;
    const isReferredRaw = searchParams.get('isReferred');
    // === END FRONTEND ADDITION ===

    const employmentStatus = employmentStatusRaw
      ? EmploymentStatusSchema.parse(employmentStatusRaw)
      : undefined;
    const clientType = clientTypeRaw ? ClientTypeSchema.parse(clientTypeRaw) : undefined;
    const clientCategory = clientCategoryRaw
      ? ClientCategoryFilterSchema.parse(clientCategoryRaw)
      : undefined;
    const status = statusRaw ? ClientStatusSchema.parse(statusRaw) : undefined;
    const isReferred =
      isReferredRaw === 'true' ? true : isReferredRaw === 'false' ? false : undefined;

    // === FRONTEND ADDITION: listClientsForOrg (company clients, members, dev-store) ===
    const { total, clients } = await listClientsForOrg(orgId!, {
      page,
      perPage,
      search,
      employmentStatus,
      clientType,
      clientCategory,
      status,
      isReferred,
      assignedMemberId: isAdviserWithRestriction ? undefined : assignedMemberId,
      restrictToAdviserUserId:
        isAdviserWithRestriction && currentUser ? currentUser.id : undefined,
    });

    let finalClients = clients.map(serializeClientSummary);
    if (hideAccountDetails) {
      finalClients = finalClients.map((c) => maskClientFinancials(c));
    }
    // === END FRONTEND ADDITION ===

    return NextResponse.json(
      { success: true, data: finalClients, meta: { total, page, perPage } },
      { status: 200 }
    );
  },
});

// ── POST /api/clients ─────────────────────────────────────────────────────────

export const POST = createHandler({
  method: 'POST',
  schema: CreateClientSchema,
  handler: async (_req: NextRequest, { body, user, orgId }) => {
    // === FRONTEND ADDITION: createClientForOrg (company + assignedMember + welcome email) ===
    const result = await createClientForOrg(orgId!, body);
    if ('error' in result) {
      if (result.error === 'VALIDATION') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              fields: result.fields,
            },
          },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create client' } },
        { status: 500 }
      );
    }

    await logAuditEvent({
      orgId: orgId!,
      userId: user?.id,
      entityType: 'Client',
      entityId: result.client.id,
      action: 'CLIENT_CREATED',
      diff: {
        after: {
          referenceNumber: result.client.referenceNumber,
          email: result.client.email,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: result.client,
        meta: {
          welcomeEmail: result.welcomeEmail,
          adviserEmail: result.adviserEmail,
        },
      },
      { status: 201 }
    );
    // === END FRONTEND ADDITION ===
  },
});
