/**
 * Unit tests for PRD-15 §6.3 calculator / intelligence formulas.
 * Run: node --import tsx --test apps/web/lib/calculators/formulas.test.ts
 * (or: pnpm exec tsx --test lib/calculators/formulas.test.ts from apps/web)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dti,
  loanToIncome,
  ltv,
  ltvBand,
  marketSignal,
  monthlyPaymentInterestOnly,
  monthlyPaymentRepayment,
  rateSensitivityLadder,
  rateTrendBps,
  vsLocalMedian,
} from './formulas.ts';

describe('ltv', () => {
  it('computes percentage', () => {
    assert.equal(ltv(280_000, 350_000), 80);
  });
  it('returns 0 for invalid property value', () => {
    assert.equal(ltv(100, 0), 0);
  });
});

describe('loanToIncome', () => {
  it('computes multiple', () => {
    assert.equal(loanToIncome(280_000, 62_000), 280_000 / 62_000);
  });
  it('returns 0 when income missing', () => {
    assert.equal(loanToIncome(280_000, 0), 0);
  });
});

describe('monthlyPaymentRepayment', () => {
  it('matches known amortisation for 4.1% / 30y / 280k', () => {
    const payment = monthlyPaymentRepayment(280_000, 4.1, 30);
    assert.ok(payment > 1340 && payment < 1360);
  });
  it('handles zero rate as principal / n', () => {
    assert.equal(monthlyPaymentRepayment(120_000, 0, 10), 1000);
  });
});

describe('monthlyPaymentInterestOnly', () => {
  it('is principal × rate / 12', () => {
    assert.equal(monthlyPaymentInterestOnly(240_000, 6), 1200);
  });
});

describe('rateSensitivityLadder', () => {
  it('centres on benchmark with five rungs', () => {
    const ladder = rateSensitivityLadder(275_000, 30, 4.1);
    assert.equal(ladder.length, 5);
    assert.equal(ladder[2].ratePct, 4.1);
    assert.equal(ladder[2].isBenchmark, true);
    assert.equal(ladder[0].ratePct, 3.1);
    assert.equal(ladder[4].ratePct, 5.1);
  });
});

describe('vsLocalMedian', () => {
  it('computes percent above median', () => {
    const pct = vsLocalMedian(350_000, 337_000);
    assert.ok(pct > 3.8 && pct < 4.0);
  });
});

describe('rateTrendBps', () => {
  it('returns negative bps when rates fell', () => {
    assert.equal(rateTrendBps(4.1, 4.65), -55);
  });
});

describe('dti', () => {
  it('marks healthy under 15%', () => {
    const r = dti(350, 62_000);
    assert.ok(r.dtiPct < 15);
    assert.equal(r.band, 'healthy');
    assert.equal(r.watch, false);
  });
  it('watches at ≥ 40%', () => {
    const r = dti(2500, 60_000);
    assert.ok(r.dtiPct >= 40);
    assert.equal(r.watch, true);
    assert.equal(r.band, 'watch');
  });
});

describe('ltvBand', () => {
  it('flags points above 75% reference', () => {
    const r = ltvBand(80);
    assert.equal(r.band, 'mainstream');
    assert.equal(r.pointsAboveReference, 5);
    assert.match(r.positionLabel, /5pts above/);
  });
  it('marks higher when LTV > 90', () => {
    assert.equal(ltvBand(92).band, 'higher');
  });
});

describe('marketSignal', () => {
  it('returns Improving when both ≤ −25bps', () => {
    assert.equal(marketSignal(-55, -50), 'Improving');
  });
  it('returns Worsening when both ≥ +25bps', () => {
    assert.equal(marketSignal(30, 40), 'Worsening');
  });
  it('returns Stable otherwise', () => {
    assert.equal(marketSignal(-10, 5), 'Stable');
  });
  it('returns null when data missing', () => {
    assert.equal(marketSignal(null, -50), null);
  });
});
