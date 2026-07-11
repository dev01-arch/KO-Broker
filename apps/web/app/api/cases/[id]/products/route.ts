import { NextRequest } from 'next/server';
import { CreateProductConsideredSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import {
  createProductForCase,
  listProductsForCase,
  serializeProductConsidered,
} from '@/lib/api/products-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/cases/[id]/products
 * List products considered for a case (RESEARCH stage).
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId } = authResult;
    const { id } = await context.params;

    const result = await listProductsForCase(orgId, id);
    if ('error' in result) return apiNotFound('Case not found');

    return apiSuccess(result.products.map(serializeProductConsidered));
  } catch (error) {
    console.error('[GET /api/cases/:id/products]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

/**
 * POST /api/cases/[id]/products
 * Record a product considered during RESEARCH.
 * Set isSelected: true to mark the recommended product (clears other selections).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = CreateProductConsideredSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await createProductForCase(orgId, id, parsed.data, user.id);
    if ('error' in result) return apiNotFound('Case not found');

    return apiSuccess(serializeProductConsidered(result.product), { status: 201 });
  } catch (error) {
    console.error('[POST /api/cases/:id/products]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
