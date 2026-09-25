/**
 * PRD-16 admin lender directory helpers.
 * Run: node --experimental-strip-types --test lib/lenders/admin-directory.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OTHER_USAGE_REVIEW_THRESHOLD,
  computeAdminLenderMeta,
  countPendingOtherUsageReview,
  isPendingOtherUsageReview,
} from './admin-directory.ts';

describe('isPendingOtherUsageReview', () => {
  it('flags names not in the directory that appear at least three times', () => {
    assert.equal(
      isPendingOtherUsageReview({ alreadyInDirectory: false, count: OTHER_USAGE_REVIEW_THRESHOLD }),
      true,
    );
  });

  it('ignores one-off Other names and names already added', () => {
    assert.equal(isPendingOtherUsageReview({ alreadyInDirectory: false, count: 2 }), false);
    assert.equal(isPendingOtherUsageReview({ alreadyInDirectory: true, count: 8 }), false);
  });
});

describe('countPendingOtherUsageReview', () => {
  it('counts only outstanding names at the review threshold', () => {
    assert.equal(
      countPendingOtherUsageReview([
        { alreadyInDirectory: false, count: 5 },
        { alreadyInDirectory: false, count: 1 },
        { alreadyInDirectory: true, count: 4 },
      ]),
      1,
    );
  });
});

describe('computeAdminLenderMeta', () => {
  it('summarises status and FRN coverage without changing adviser search rules', () => {
    assert.deepEqual(
      computeAdminLenderMeta([
        { status: 'ACTIVE', fcaFrn: '123456' },
        { status: 'ACTIVE', fcaFrn: null },
        { status: 'LEGACY', fcaFrn: '654321' },
        { status: 'INACTIVE', fcaFrn: null },
      ]),
      { total: 4, active: 2, legacy: 1, inactive: 1, withFrn: 2 },
    );
  });
});
