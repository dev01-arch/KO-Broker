import { NextRequest } from 'next/server';
import { EmploymentStatusSchema, CreateClientSchema, ClientTypeSchema, ClientStatusSchema, ClientCategoryFilterSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { createClientForOrg, listClientsForOrg } from '@/lib/api/clients-data';
import { serializeClientSummary } from '@/lib/api/clients';
import { apiError, apiFromZodError, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET(req: NextRequest) {
  try {
    return await listClients(req);
  } catch (error) {
    console.error('[GET /api/clients]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function listClients(req: NextRequest) {
  const authResult = await requireApiAuth();
  if ('response' in authResult) return authResult.response;

  const { orgId } = authResult;
  const { searchParams } = req.nextUrl;

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '10') || 10));
  const search = searchParams.get('search')?.trim();
  const employmentStatusRaw = searchParams.get('employmentStatus');
  const clientTypeRaw = searchParams.get('clientType');
  const clientCategoryRaw = searchParams.get('clientCategory');
  const statusRaw = searchParams.get('status');
  const assignedMemberId = searchParams.get('assignedMemberId')?.trim() || undefined;
  const isReferredRaw = searchParams.get('isReferred');

  let employmentStatus;
  if (employmentStatusRaw) {
    const parsed = EmploymentStatusSchema.safeParse(employmentStatusRaw);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }
    employmentStatus = parsed.data;
  }

  let clientType;
  if (clientTypeRaw) {
    const parsed = ClientTypeSchema.safeParse(clientTypeRaw);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }
    clientType = parsed.data;
  }

  let clientCategory;
  if (clientCategoryRaw) {
    const parsed = ClientCategoryFilterSchema.safeParse(clientCategoryRaw);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }
    clientCategory = parsed.data;
  }

  let status;
  if (statusRaw) {
    const parsed = ClientStatusSchema.safeParse(statusRaw);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }
    status = parsed.data;
  }

  let isReferred: boolean | undefined;
  if (isReferredRaw === 'true') isReferred = true;
  if (isReferredRaw === 'false') isReferred = false;

  const { total, clients } = await listClientsForOrg(orgId, {
    page,
    perPage,
    search,
    employmentStatus,
    clientType,
    clientCategory,
    status,
    assignedMemberId,
    isReferred,
  });

  return apiSuccess(clients.map(serializeClientSummary), {
    meta: { total, page, perPage },
  });
}

export async function POST(req: NextRequest) {
  try {
    return await createClient(req);
  } catch (error) {
    console.error('[POST /api/clients]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function createClient(req: NextRequest) {
  const authResult = await requireApiAuth();
  if ('response' in authResult) return authResult.response;

  const { orgId } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
  }

  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) {
    return apiFromZodError(parsed.error);
  }

  const input = parsed.data;
  const result = await createClientForOrg(orgId, {
    clientType: input.clientType,
    title: input.title,
    firstName: input.firstName,
    lastName: input.lastName,
    companyName: input.companyName,
    companyNumber: input.companyNumber,
    email: input.email,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
    employmentStatus: input.employmentStatus,
    annualIncome: input.annualIncome,
    isReferred: input.isReferred,
    referredToCompany: input.referredToCompany,
    assignedMemberId: input.assignedMemberId,
    insurerName: input.insurerName,
  });

  if ('error' in result) {
    const fields = result.fields ?? {};
    const fieldErrors = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, [value]]),
    ) as Record<string, string[]>;
    return apiError('VALIDATION_ERROR', 'Request validation failed', 422, {
      fields: fieldErrors,
    });
  }

  return apiSuccess(result.client, { status: 201 });
}
