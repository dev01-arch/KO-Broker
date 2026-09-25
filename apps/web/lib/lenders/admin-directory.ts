/**
 * Helpers for the ADMIN lender-directory Settings panel (PRD-16 FCA maintenance).
 * Discovery is human-driven via Other-usage; advisers keep GET /api/lenders.
 */

export const OTHER_USAGE_REVIEW_THRESHOLD = 3;

export type OtherUsageReviewRow = {
  alreadyInDirectory: boolean;
  count: number;
};

export function isPendingOtherUsageReview(row: OtherUsageReviewRow): boolean {
  return !row.alreadyInDirectory && row.count >= OTHER_USAGE_REVIEW_THRESHOLD;
}

export function countPendingOtherUsageReview(rows: OtherUsageReviewRow[]): number {
  return rows.filter(isPendingOtherUsageReview).length;
}

export type AdminLenderMetaInput = {
  status: string;
  fcaFrn?: string | null;
};

export function computeAdminLenderMeta(lenders: AdminLenderMetaInput[]) {
  return {
    total: lenders.length,
    active: lenders.filter((lender) => lender.status === 'ACTIVE').length,
    legacy: lenders.filter((lender) => lender.status === 'LEGACY').length,
    inactive: lenders.filter((lender) => lender.status === 'INACTIVE').length,
    withFrn: lenders.filter((lender) => Boolean(lender.fcaFrn)).length,
  };
}
