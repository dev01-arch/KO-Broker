import { NextRequest } from 'next/server';
import { UpdateProductConsideredSchema } from '@ko/types';
import { requireApiAuth } from '@/lib/api/require-api-auth';
import {
  deleteProductForCase,
  serializeProductConsidered,
  updateProductForCase,
} from '@/lib/api/products-data';
import { apiError, apiFromZodError, apiNotFound, apiSuccess } from '@/lib/api/responses';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

type RouteContext = { params: Promise<{ id: string; productId: string }> };

/**
 * PATCH /api/cases/[id]/products/[productId]
 * Update a product considered row. Setting isSelected: true selects it as the recommendation.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const { id, productId } = await context.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body', 422);
    }

    const parsed = UpdateProductConsideredSchema.safeParse(body);
    if (!parsed.success) return apiFromZodError(parsed.error);

    const result = await updateProductForCase(orgId, id, productId, parsed.data, user.id);
    if ('error' in result) {
      return apiNotFound(
        'message' in result && result.message ? result.message : 'Product not found',
      );
    }

    return apiSuccess(serializeProductConsidered(result.product));
  } catch (error) {
    console.error('[PATCH /api/cases/:id/products/:productId]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

/**
 * DELETE /api/cases/[id]/products/[productId]
 * Remove a product considered row. Clears case selection if it was selected.
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireApiAuth();
    if ('response' in authResult) return authResult.response;

    const { orgId, user } = authResult;
    const { id, productId } = await context.params;

    const result = await deleteProductForCase(orgId, id, productId, user.id);
    if ('error' in result) {
      return apiNotFound(
        'message' in result && result.message ? result.message : 'Product not found',
      );
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('[DELETE /api/cases/:id/products/:productId]', error);
    if (isPrismaConnectionError(error)) {
      return apiError('SERVICE_UNAVAILABLE', 'Database is unavailable', 503);
    }
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
