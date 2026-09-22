/**
 * Recommendation stale logic — PRD-16 W4
 *
 * checkAndSetRecommendationStale:
 *   Called inside any mutation that changes a qualifying fact after a product
 *   is already selected. Sets recommendationStaleAt on the Case, drops any
 *   non-finalised suitability reports back to DRAFT, writes a SYSTEM CaseNote,
 *   and logs an audit event.
 *
 * clearRecommendationStale:
 *   Called when an adviser re-selects a product (same or new). Clears
 *   recommendationStaleAt, writes a SYSTEM CaseNote, and logs an audit event.
 *
 * Both functions accept an optional Prisma transaction client so they can
 * participate in the caller's existing transaction.
 *
 * FINALISED reports are NEVER touched — only DRAFT and ADVISER_REVIEW are
 * reset to DRAFT. APPROVED reports are also left alone per PRD-16 decisions.
 */

import type { Prisma } from '@ko/db';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';

type TxClient = Prisma.TransactionClient;

/**
 * Qualifying fields — changes to any of these after a product is selected
 * will trigger the stale flag.
 */
export const STALE_TRIGGER_FIELDS = [
  'loanAmount',
  'propertyValue',
  'termYears',
  'propertyId',
  'ltv',
] as const;

export type StaleTriggerField = (typeof STALE_TRIGGER_FIELDS)[number];

/**
 * checkAndSetRecommendationStale
 *
 * Idempotent — if already stale, updates the reason but does not double-fire
 * the CaseNote or the report reset (reports already at DRAFT stay DRAFT).
 *
 * Returns true if stale was newly set, false if skipped (no selected product).
 */
export async function checkAndSetRecommendationStale(
  {
    orgId,
    caseId,
    changedFields,
    reason,
    userId,
  }: {
    orgId: string;
    caseId: string;
    changedFields: string[];
    reason: string;
    userId?: string;
  },
  tx?: TxClient,
): Promise<boolean> {
  const db = tx ?? prisma;

  // 1. Check if a product is selected — skip entirely if none
  const hasSelected = await db.productConsidered.count({
    where: { caseId, isSelected: true },
  });
  if (hasSelected === 0) return false;

  const now = new Date();

  // 2. Fetch current stale state
  const caseRow = await db.case.findFirst({
    where: { id: caseId },
    select: { recommendationStaleAt: true },
  });
  const alreadyStale = caseRow?.recommendationStaleAt !== null && caseRow?.recommendationStaleAt !== undefined;

  // 3. Set stale on Case
  await db.case.update({
    where: { id: caseId },
    data: {
      recommendationStaleAt: now,
      recommendationStaleReason: reason,
    },
  });

  // 4. Drop non-FINALISED, non-APPROVED reports back to DRAFT
  //    Only touch DRAFT and ADVISER_REVIEW — leave APPROVED and FINALISED.
  await db.suitabilityReport.updateMany({
    where: {
      caseId,
      status: { in: ['DRAFT', 'ADVISER_REVIEW'] },
    },
    data: { status: 'DRAFT' },
  });

  // 5. Write a SYSTEM CaseNote — only on first stale set, not on re-trigger
  if (!alreadyStale) {
    await db.caseNote.create({
      data: {
        orgId,
        caseId,
        body: `Recommendation marked stale: ${reason}`,
        tag: 'amend',
        source: 'SYSTEM',
        authorUserId: userId ?? null,
      },
    });
  }

  // 6. Audit log (outside tx so it never blocks the caller)
  void logAuditEvent({
    orgId,
    userId,
    entityType: 'Case',
    entityId: caseId,
    action: 'RECOMMENDATION_STALE',
    diff: { reason, changedFields },
  });

  return true;
}

/**
 * clearRecommendationStale
 *
 * Called when the adviser re-selects a product (same or new).
 * Clears recommendationStaleAt + reason, writes a SYSTEM CaseNote, audits.
 *
 * Safe to call even if the case is not currently stale (no-op on the note).
 */
export async function clearRecommendationStale(
  {
    orgId,
    caseId,
    productId,
    lenderName,
    userId,
  }: {
    orgId: string;
    caseId: string;
    productId: string;
    lenderName: string;
    userId?: string;
  },
  tx?: TxClient,
): Promise<void> {
  const db = tx ?? prisma;

  // Only write note + audit if it was actually stale
  const caseRow = await db.case.findFirst({
    where: { id: caseId },
    select: { recommendationStaleAt: true },
  });
  const wasStale = caseRow?.recommendationStaleAt !== null && caseRow?.recommendationStaleAt !== undefined;

  await db.case.update({
    where: { id: caseId },
    data: {
      recommendationStaleAt: null,
      recommendationStaleReason: null,
    },
  });

  if (wasStale) {
    await db.caseNote.create({
      data: {
        orgId,
        caseId,
        body: `Recommendation stale flag cleared: product re-selected (${lenderName})`,
        tag: 'amend',
        source: 'SYSTEM',
        authorUserId: userId ?? null,
      },
    });

    void logAuditEvent({
      orgId,
      userId,
      entityType: 'Case',
      entityId: caseId,
      action: 'RECOMMENDATION_STALE_CLEARED',
      diff: { productId, lenderName },
    });
  }
}
