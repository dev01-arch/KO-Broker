import { NextRequest } from 'next/server';
import { CaseStageSchema, CaseTypeSchema, CreateCaseSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import { createCaseForOrg, listCasesForOrg } from '@/lib/api/cases-data';
import { serializeCaseSummary } from '@/lib/api/cases';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

export async function GET(req: NextRequest) {
  try {
    return await listCases(req);
  } catch (error) {
    console.error('[GET /api/cases]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function listCases(req: NextRequest) {
  const authResult = await requireApiAuth();
  if ('response' in authResult) return authResult.response;

  const { orgId } = authResult;
  const { searchParams } = req.nextUrl;

  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage') ?? '25') || 25));
  const search = searchParams.get('search')?.trim();
  const clientId = searchParams.get('clientId')?.trim();
  const adviserId = searchParams.get('adviserId')?.trim();

  let stage;
  const stageRaw = searchParams.get('stage');
  if (stageRaw) {
    const parsed = CaseStageSchema.safeParse(stageRaw);
    if (!parsed.success) return apiFromZodError(parsed.error);
    stage = parsed.data;
  }

  let type;
  const typeRaw = searchParams.get('type');
  if (typeRaw) {
    const parsed = CaseTypeSchema.safeParse(typeRaw);
    if (!parsed.success) return apiFromZodError(parsed.error);
    type = parsed.data;
  }

  const { total, cases } = await listCasesForOrg(orgId, {
    page,
    perPage,
    search,
    stage,
    type,
    clientId,
    adviserId,
  });

  return apiSuccess(cases.map(serializeCaseSummary), {
    meta: { total, page, perPage },
  });
}

export async function POST(req: NextRequest) {
  try {
    return await createCase(req);
  } catch (error) {
    console.error('[POST /api/cases]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

async function createCase(req: NextRequest) {
  const authResult = await requireApiAuth();
  if ('response' in authResult) return authResult.response;

  const { orgId } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
  }

  const parsed = CreateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return apiFromZodError(parsed.error);
  }

  const result = await createCaseForOrg(orgId, parsed.data);
  if ('error' in result) {
    return apiNotFound('Client not found');
  }

  return apiSuccess(serializeCaseSummary(result.case), { status: 201 });
}
