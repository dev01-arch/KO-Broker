import { NextRequest } from 'next/server';
import { EmploymentStatusSchema, CreateClientSchema } from '@ko/types';
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
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '25') || 25));
  const search = searchParams.get('search')?.trim();
  const employmentStatusRaw = searchParams.get('employmentStatus');

  let employmentStatus;
  if (employmentStatusRaw) {
    const parsed = EmploymentStatusSchema.safeParse(employmentStatusRaw);
    if (!parsed.success) {
      return apiFromZodError(parsed.error);
    }
    employmentStatus = parsed.data;
  }

  const { total, clients } = await listClientsForOrg(orgId, {
    page,
    perPage,
    search,
    employmentStatus,
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
  });

  return apiSuccess(result.client, { status: 201 });
}
