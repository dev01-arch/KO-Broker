import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/api/require-api-auth';import { createAdviserForOrg, listAdvisersForOrg } from '@/lib/api/settings-data';
import { apiError, apiFromZodError, apiSuccess } from '@/lib/api/responses';
import { isPrismaAnyUniqueConflict, isPrismaConnectionError } from '@/lib/api/prisma-errors';

const CreateAdviserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Valid email is required'),
});

export async function GET() {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId } = authResult;

    const advisers = await listAdvisersForOrg(orgId);
    return apiSuccess(advisers);
  } catch (error) {
    console.error('[GET /api/settings/advisers]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;
    const { orgId, user } = authResult;
    if (user.role !== 'ADMIN') {
      return apiError('FORBIDDEN', 'Admin role required', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = CreateAdviserSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const adviser = await createAdviserForOrg(orgId, parsed.data);
    return apiSuccess(adviser, { status: 201 });
  } catch (error) {
    if (isPrismaAnyUniqueConflict(error)) {
      return apiError('VALIDATION_ERROR', 'A member with this email already exists', 422, {
        fields: { email: ['A member with this email already exists'] },
      });
    }
    if (error instanceof Error && error.message === 'MEMBER_EMAIL_EXISTS') {
      return apiError('VALIDATION_ERROR', 'A member with this email already exists', 422, {
        fields: { email: ['A member with this email already exists'] },
      });
    }
    console.error('[POST /api/settings/advisers]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
