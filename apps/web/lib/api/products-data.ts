/**
 * Products data layer — PRD-05 + PRD-16 W1
 *
 * PRD-16 changes:
 * - createProductForCase / updateProductForCase now accept lenderId (FK).
 * - When lenderId is supplied, lenderName is derived from the Lender row so
 *   both columns stay in sync during the transition period.
 * - When a product is selected, Case.lenderId is written alongside the legacy
 *   Case.selectedLender string.
 * - lenderName fallback: if only lenderName is provided (old callers), it is
 *   written directly and lenderId stays null — backward compatible.
 */

import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { logAuditEvent } from '@/lib/compliance/audit';
import type {
  CreateProductConsideredInput,
  UpdateProductConsideredInput,
} from '@ko/types';

function shouldUseDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

// ── Serialiser ────────────────────────────────────────────────────────────────

export function serializeProductConsidered(product: {
  id: string;
  caseId: string;
  lenderName: string;
  productName: string;
  rate?: number | null;
  fee?: number | null;
  isSelected: boolean;
  reasonNotSelected?: string | null;
  createdAt: Date | string;
  // PRD-16 fields (optional — only present after Phase 1 migration)
  lenderId?: string | null;
  lenderOtherName?: string | null;
  productType?: string | null;
  initialTermMonths?: number | null;
  ercSummary?: string | null;
}) {
  return {
    id: product.id,
    caseId: product.caseId,
    lenderName: product.lenderName,
    productName: product.productName,
    rate: product.rate ?? undefined,
    fee: product.fee ?? undefined,
    isSelected: product.isSelected,
    reasonNotSelected: product.reasonNotSelected ?? undefined,
    createdAt:
      typeof product.createdAt === 'string'
        ? product.createdAt
        : product.createdAt.toISOString(),
    // PRD-16
    lenderId: product.lenderId ?? undefined,
    lenderOtherName: product.lenderOtherName ?? undefined,
    productType: product.productType ?? undefined,
    initialTermMonths: product.initialTermMonths ?? undefined,
    ercSummary: product.ercSummary ?? undefined,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertCaseInOrg(orgId: string, caseId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, orgId },
    select: { id: true },
  });
}

/**
 * Resolve the display name for a lender given the input fields.
 *
 * Priority:
 * 1. lenderId provided → fetch Lender row → use Lender.name
 *    (if lenderId refers to the "Other" sentinel → use lenderOtherName)
 * 2. lenderName provided (legacy / backward compat) → use as-is
 * 3. Neither → returns null (caller should have validated before reaching here)
 */
async function resolveLenderName(
  lenderId?: string | null,
  lenderOtherName?: string | null,
  lenderNameFallback?: string | null,
): Promise<{ lenderName: string; lenderId: string | null } | null> {
  if (lenderId) {
    const lender = await prisma.lender.findUnique({
      where: { id: lenderId },
      select: { id: true, name: true, source: true },
    });
    if (!lender) return null;
    const displayName = lender.source === 'OTHER'
      ? (lenderOtherName?.trim() || 'Other')
      : lender.name;
    return { lenderName: displayName, lenderId: lender.id };
  }
  if (lenderNameFallback?.trim()) {
    return { lenderName: lenderNameFallback.trim(), lenderId: null };
  }
  return null;
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listProductsForCase(orgId: string, caseId: string) {
  try {
    const caseRecord = await assertCaseInOrg(orgId, caseId);
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const products = await prisma.productConsidered.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    return { products };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.listProducts(orgId, caseId);
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createProductForCase(
  orgId: string,
  caseId: string,
  input: CreateProductConsideredInput,
  userId?: string,
) {
  try {
    const caseRecord = await assertCaseInOrg(orgId, caseId);
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    // Resolve lender — FK takes priority over legacy free-text
    const resolved = await resolveLenderName(
      input.lenderId,
      input.lenderOtherName,
      input.lenderName,
    );
    if (!resolved) {
      return { error: 'VALIDATION_ERROR' as const, message: 'Invalid lenderId or lenderName is required' };
    }

    const product = await prisma.$transaction(async (tx) => {
      if (input.isSelected) {
        await tx.productConsidered.updateMany({
          where: { caseId, isSelected: true },
          data: { isSelected: false },
        });
      }

      const created = await tx.productConsidered.create({
        data: {
          caseId,
          lenderName: resolved.lenderName,
          productName: input.productName,
          rate: input.rate,
          fee: input.fee,
          isSelected: input.isSelected ?? false,
          reasonNotSelected: input.reasonNotSelected,
          // PRD-16 fields
          lenderId: resolved.lenderId,
          lenderOtherName: resolved.lenderId ? (input.lenderOtherName ?? null) : null,
          productType: input.productType ?? null,
          initialTermMonths: input.initialTermMonths ?? null,
          ercSummary: input.ercSummary ?? null,
        },
      });

      if (created.isSelected) {
        await tx.case.update({
          where: { id: caseId },
          data: {
            // Legacy string fields kept in sync
            selectedLender: created.lenderName,
            selectedProduct: created.productName,
            selectedRate: created.rate ?? null,
            selectedFee: created.fee ?? null,
            // PRD-16: FK on Case
            lenderId: resolved.lenderId,
            lenderOtherName: resolved.lenderId ? (input.lenderOtherName ?? null) : null,
            updatedAt: new Date(),
          },
        });
      }

      return created;
    });

    await logAuditEvent({
      orgId,
      userId,
      entityType: 'Case',
      entityId: caseId,
      action: product.isSelected ? 'PRODUCT_SELECTED' : 'PRODUCT_RECORDED',
      diff: {
        after: {
          productId: product.id,
          lenderName: product.lenderName,
          lenderId: product.lenderId,
          productName: product.productName,
          isSelected: product.isSelected,
        },
      },
    });

    return { product };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.createProduct(orgId, caseId, input);
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateProductForCase(
  orgId: string,
  caseId: string,
  productId: string,
  input: UpdateProductConsideredInput,
  userId?: string,
) {
  try {
    const caseRecord = await assertCaseInOrg(orgId, caseId);
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const existing = await prisma.productConsidered.findFirst({
      where: { id: productId, caseId },
    });
    if (!existing) return { error: 'NOT_FOUND' as const, message: 'Product not found' };

    // Resolve lender if lenderId is being changed
    let resolved: { lenderName: string; lenderId: string | null } | null = null;
    const isChangingLender = input.lenderId !== undefined || input.lenderName !== undefined;

    if (isChangingLender) {
      resolved = await resolveLenderName(
        input.lenderId,
        input.lenderOtherName ?? undefined,
        input.lenderName,
      );
      if (!resolved) {
        return { error: 'VALIDATION_ERROR' as const, message: 'Invalid lenderId' };
      }
    }

    const product = await prisma.$transaction(async (tx) => {
      if (input.isSelected === true) {
        await tx.productConsidered.updateMany({
          where: { caseId, isSelected: true, NOT: { id: productId } },
          data: { isSelected: false },
        });
      }

      const updated = await tx.productConsidered.update({
        where: { id: productId },
        data: {
          // Lender fields — only update if changing
          ...(resolved ? { lenderName: resolved.lenderName, lenderId: resolved.lenderId } : {}),
          ...(input.lenderOtherName !== undefined ? { lenderOtherName: input.lenderOtherName } : {}),
          // Other fields
          ...(input.productName !== undefined ? { productName: input.productName } : {}),
          ...(input.rate !== undefined ? { rate: input.rate } : {}),
          ...(input.fee !== undefined ? { fee: input.fee } : {}),
          ...(input.isSelected !== undefined ? { isSelected: input.isSelected } : {}),
          ...(input.reasonNotSelected !== undefined ? { reasonNotSelected: input.reasonNotSelected } : {}),
          // PRD-16 product detail fields
          ...(input.productType !== undefined ? { productType: input.productType } : {}),
          ...(input.initialTermMonths !== undefined ? { initialTermMonths: input.initialTermMonths } : {}),
          ...(input.ercSummary !== undefined ? { ercSummary: input.ercSummary } : {}),
        },
      });

      if (updated.isSelected) {
        await tx.case.update({
          where: { id: caseId },
          data: {
            selectedLender: updated.lenderName,
            selectedProduct: updated.productName,
            selectedRate: updated.rate ?? null,
            selectedFee: updated.fee ?? null,
            // PRD-16: sync lenderId on Case when product is selected
            lenderId: updated.lenderId,
            lenderOtherName: updated.lenderOtherName,
            updatedAt: new Date(),
          },
        });
      } else if (existing.isSelected && input.isSelected === false) {
        await tx.case.update({
          where: { id: caseId },
          data: {
            selectedLender: null,
            selectedProduct: null,
            selectedRate: null,
            selectedFee: null,
            lenderId: null,
            lenderOtherName: null,
            updatedAt: new Date(),
          },
        });
      }

      return updated;
    });

    await logAuditEvent({
      orgId,
      userId,
      entityType: 'Case',
      entityId: caseId,
      action: input.isSelected === true ? 'PRODUCT_SELECTED' : 'PRODUCT_UPDATED',
      diff: {
        before: {
          productId: existing.id,
          lenderName: existing.lenderName,
          lenderId: existing.lenderId,
          productName: existing.productName,
          isSelected: existing.isSelected,
        },
        after: {
          productId: product.id,
          lenderName: product.lenderName,
          lenderId: product.lenderId,
          productName: product.productName,
          isSelected: product.isSelected,
        },
      },
    });

    return { product };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.updateProduct(orgId, caseId, productId, input);
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteProductForCase(
  orgId: string,
  caseId: string,
  productId: string,
  userId?: string,
) {
  try {
    const caseRecord = await assertCaseInOrg(orgId, caseId);
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const existing = await prisma.productConsidered.findFirst({
      where: { id: productId, caseId },
    });
    if (!existing) return { error: 'NOT_FOUND' as const, message: 'Product not found' };

    await prisma.$transaction(async (tx) => {
      await tx.productConsidered.delete({ where: { id: productId } });
      if (existing.isSelected) {
        await tx.case.update({
          where: { id: caseId },
          data: {
            selectedLender: null,
            selectedProduct: null,
            selectedRate: null,
            selectedFee: null,
            lenderId: null,
            lenderOtherName: null,
            updatedAt: new Date(),
          },
        });
      }
    });

    await logAuditEvent({
      orgId,
      userId,
      entityType: 'Case',
      entityId: caseId,
      action: 'PRODUCT_REMOVED',
      diff: {
        before: {
          productId: existing.id,
          lenderName: existing.lenderName,
          lenderId: existing.lenderId,
          productName: existing.productName,
          isSelected: existing.isSelected,
        },
      },
    });

    return { ok: true as const };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.deleteProduct(orgId, caseId, productId);
  }
}
