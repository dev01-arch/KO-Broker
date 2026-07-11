import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { logAuditEvent } from '@/lib/compliance/audit';
import type {
  CreateProductConsideredInput,
  UpdateProductConsideredInput,
} from '@ko/types';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

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
  };
}

async function assertCaseInOrg(orgId: string, caseId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, orgId },
    select: { id: true },
  });
}

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
    if (!useDevStore(error)) throw error;
    return devStore.listProducts(orgId, caseId);
  }
}

export async function createProductForCase(
  orgId: string,
  caseId: string,
  input: CreateProductConsideredInput,
  userId?: string,
) {
  try {
    const caseRecord = await assertCaseInOrg(orgId, caseId);
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

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
          lenderName: input.lenderName,
          productName: input.productName,
          rate: input.rate,
          fee: input.fee,
          isSelected: input.isSelected ?? false,
          reasonNotSelected: input.reasonNotSelected,
        },
      });

      if (created.isSelected) {
        await tx.case.update({
          where: { id: caseId },
          data: {
            selectedLender: created.lenderName,
            selectedProduct: created.productName,
            selectedRate: created.rate ?? null,
            selectedFee: created.fee ?? null,
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
          productName: product.productName,
          isSelected: product.isSelected,
        },
      },
    });

    return { product };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return devStore.createProduct(orgId, caseId, input);
  }
}

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
          ...(input.lenderName !== undefined ? { lenderName: input.lenderName } : {}),
          ...(input.productName !== undefined ? { productName: input.productName } : {}),
          ...(input.rate !== undefined ? { rate: input.rate } : {}),
          ...(input.fee !== undefined ? { fee: input.fee } : {}),
          ...(input.isSelected !== undefined ? { isSelected: input.isSelected } : {}),
          ...(input.reasonNotSelected !== undefined
            ? { reasonNotSelected: input.reasonNotSelected }
            : {}),
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
      action:
        input.isSelected === true
          ? 'PRODUCT_SELECTED'
          : 'PRODUCT_UPDATED',
      diff: {
        before: {
          productId: existing.id,
          lenderName: existing.lenderName,
          productName: existing.productName,
          isSelected: existing.isSelected,
        },
        after: {
          productId: product.id,
          lenderName: product.lenderName,
          productName: product.productName,
          isSelected: product.isSelected,
        },
      },
    });

    return { product };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return devStore.updateProduct(orgId, caseId, productId, input);
  }
}

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
          productName: existing.productName,
          isSelected: existing.isSelected,
        },
      },
    });

    return { ok: true as const };
  } catch (error) {
    if (!useDevStore(error)) throw error;
    return devStore.deleteProduct(orgId, caseId, productId);
  }
}
