/**
 * Lender data layer — PRD-16 W0
 *
 * Global reference directory. No orgId — lenders are shared across all orgs.
 * INACTIVE rows are hidden from search; LEGACY rows are included (needed for remortgage).
 * The "Other" sentinel row (source = OTHER) is always appended last.
 */

import { prisma } from '@/lib/db';
import type { LenderRow } from '@ko/types';

/** Appendix A omitted this name. The API reads the lenders table, so the row has to exist there. */
const BARCLAYS_BANK = {
  name: 'Barclays Bank',
  normalizedName: 'barclays bank',
  fcaFrn: '122702',
} as const;

let barclaysReady = false;

async function ensureBarclaysBank(): Promise<void> {
  if (barclaysReady) return;
  const existing = await prisma.lender.findUnique({
    where: { normalizedName: BARCLAYS_BANK.normalizedName },
    select: { id: true, fcaFrn: true, status: true },
  });
  if (!existing) {
    try {
      await prisma.lender.create({
        data: {
          name: BARCLAYS_BANK.name,
          normalizedName: BARCLAYS_BANK.normalizedName,
          status: 'ACTIVE',
          source: 'SEED',
          fcaFrn: BARCLAYS_BANK.fcaFrn,
        },
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code !== 'P2002') throw error;
    }
  } else if (!existing.fcaFrn && existing.status !== 'INACTIVE') {
    await prisma.lender.update({
      where: { id: existing.id },
      data: { fcaFrn: BARCLAYS_BANK.fcaFrn },
    });
  }
  barclaysReady = true;
}

/**
 * searchLenders — returns up to 20 lenders matching the query.
 *
 * - Excludes INACTIVE rows.
 * - LEGACY rows (closed brands) are included so advisers can record
 *   remortgage products against them.
 * - The "Other" sentinel row is always present, sorted to the end.
 * - If no query is provided, returns the first 20 ACTIVE/LEGACY rows
 *   plus the Other sentinel.
 */
export async function searchLenders(q?: string): Promise<LenderRow[]> {
  try {
    await ensureBarclaysBank();
  } catch (error) {
    console.error('[lenders] could not ensure Barclays Bank', error);
  }

  const trimmed = q?.trim() ?? '';

  // Fetch up to 20 matching non-Other rows
  const rows = await prisma.lender.findMany({
    where: {
      status: { not: 'INACTIVE' },
      source: { not: 'OTHER' }, // exclude Other from the main sorted list
      ...(trimmed
        ? { name: { contains: trimmed, mode: 'insensitive' } }
        : {}),
    },
    orderBy: { name: 'asc' },
    take: 20,
    select: {
      id: true,
      name: true,
      normalizedName: true,
      status: true,
      source: true,
    },
  });

  // Always append the Other sentinel as the last option
  const other = await prisma.lender.findFirst({
    where: { source: 'OTHER' },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      status: true,
      source: true,
    },
  });

  return other ? [...rows, other] : rows;
}

/**
 * getLenderById — fetch a single lender by id.
 * Used by product/case handlers to validate a lenderId before writing.
 */
export async function getLenderById(id: string): Promise<LenderRow | null> {
  return prisma.lender.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      status: true,
      source: true,
    },
  });
}
