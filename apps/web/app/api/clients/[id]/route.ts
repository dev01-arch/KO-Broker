import { NextRequest } from 'next/server';
import { z } from 'zod';
import { EmploymentStatusSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { deleteClientForOrg, getClientForOrg, updateClientForOrg } from '@/lib/api/clients-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

const UpdateClientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  employmentStatus: EmploymentStatusSchema.optional(),
  annualIncome: z.number().positive().optional(),
  isVulnerable: z.boolean().optional(),
  vulnerabilityNotes: z.string().optional(),
  portalEnabled: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;

    const client = await getClientForOrg(orgId, id);
    if (!client) {
      return apiNotFound('Client not found');
    }

    return apiSuccess({
      id: client.id,
      referenceNumber: client.referenceNumber,
      clientType: client.clientType,
      companyName: 'companyName' in client ? client.companyName ?? undefined : undefined,
      companyNumber: 'companyNumber' in client ? client.companyNumber ?? undefined : undefined,
      title: 'title' in client && client.title ? client.title : undefined,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: 'phone' in client ? client.phone ?? undefined : undefined,
      dateOfBirth:
        'dateOfBirth' in client && client.dateOfBirth
          ? typeof client.dateOfBirth === 'string'
            ? client.dateOfBirth.slice(0, 10)
            : client.dateOfBirth.toISOString().slice(0, 10)
          : undefined,
      employmentStatus: client.employmentStatus,
      annualIncome: client.annualIncome ?? undefined,
      isVulnerable: client.isVulnerable,
      vulnerabilityNotes:
        'vulnerabilityNotes' in client ? client.vulnerabilityNotes ?? undefined : undefined,
      portalEnabled: client.portalEnabled,
      cases: 'cases' in client ? client.cases : [],
      _count: client._count,
    });
  } catch (error) {
    console.error('[GET /api/clients/:id]', error);
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = UpdateClientSchema.safeParse(body);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }

    const client = await updateClientForOrg(orgId, id, parsed.data);
    if (!client) {
      return apiNotFound('Client not found');
    }

    return apiSuccess(client);
  } catch (error) {
    console.error('[PATCH /api/clients/:id]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;

    const result = await deleteClientForOrg(orgId, id);
    if ('error' in result) {
      return apiNotFound('Client not found');
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('[DELETE /api/clients/:id]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
