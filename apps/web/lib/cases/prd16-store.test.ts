/**
 * PRD-16 frontend store helpers.
 * Run: node --experimental-strip-types --test lib/cases/prd16-store.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  factsMoved,
  isWithinDays,
  radarCaseIds,
  recommendationFingerprint,
} from './prd16-store.ts';

describe('recommendationFingerprint', () => {
  it('changes when loan amount changes', () => {
    const a = recommendationFingerprint({ loanAmount: 200000, lender: 'Halifax', product: '5yr' });
    const b = recommendationFingerprint({ loanAmount: 210000, lender: 'Halifax', product: '5yr' });
    assert.notEqual(a, b);
  });
});

describe('factsMoved', () => {
  it('is true when term changes', () => {
    assert.equal(
      factsMoved({ loanAmount: 1, propertyValue: 2, termYears: 25 }, { loanAmount: 1, propertyValue: 2, termYears: 30 }),
      true,
    );
  });

  it('is false when only lender changes', () => {
    assert.equal(
      factsMoved({ loanAmount: 1, lender: 'A' }, { loanAmount: 1, lender: 'B' }),
      false,
    );
  });
});

describe('radarCaseIds', () => {
  it('keeps offers ending within 14 days', () => {
    const now = Date.parse('2026-09-22T12:00:00Z');
    const ids = radarCaseIds(
      ['soon', 'later'],
      'offers14',
      (id) => ({
        offerExpiresAt: id === 'soon' ? '2026-09-30' : '2026-12-01',
      }),
      now,
    );
    assert.deepEqual(ids, ['soon']);
  });

  it('isWithinDays rejects past dates', () => {
    assert.equal(isWithinDays('2026-01-01', 14, Date.parse('2026-09-22T12:00:00Z')), false);
  });
});
