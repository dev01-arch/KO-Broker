/**
 * Intelligence formula implementations — PRD-15 B7
 *
 * TEMPORARY DUPLICATE — delete this file once F2 (formulas.ts extraction) merges.
 * At that point, replace all imports of this file with imports from
 * '@/lib/calculators/formulas'.
 *
 * Functions match the exact signatures specified in PRD-15 §6.3.
 * All are pure — no side effects, no API calls.
 */

import type { MarketSignal } from '@ko/types';

// ── LTV ───────────────────────────────────────────────────────────────────────

/** Loan-to-Value ratio as a percentage (0–100+). */
export function ltv(mortgageAmount: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return (mortgageAmount / propertyValue) * 100;
}

/** LTV band label. Returns 'HIGH' when LTV > 90, else 'STANDARD'. */
export function ltvBand(ltvPct: number): 'HIGH' | 'STANDARD' {
  return ltvPct > 90 ? 'HIGH' : 'STANDARD';
}

// ── LTI ──────────────────────────────────────────────────────────────────────

/** Loan-to-Income ratio. grossIncome must be annual. */
export function loanToIncome(mortgageAmount: number, grossIncome: number): number {
  if (grossIncome <= 0) return 0;
  return mortgageAmount / grossIncome;
}

// ── DTI ──────────────────────────────────────────────────────────────────────

/** Debt-to-Income ratio as a percentage. monthlyCommitments / (grossIncome / 12) * 100. */
export function dti(monthlyCommitments: number, grossIncome: number): number {
  const monthlyIncome = grossIncome / 12;
  if (monthlyIncome <= 0) return 0;
  return (monthlyCommitments / monthlyIncome) * 100;
}

/** DTI band. 'WATCH' if DTI ≥ 40%, else 'OK'. */
export function dtiBand(dtiPct: number): 'WATCH' | 'OK' {
  return dtiPct >= 40 ? 'WATCH' : 'OK';
}

// ── Monthly payment ───────────────────────────────────────────────────────────

/**
 * Monthly repayment (capital + interest) using standard annuity formula.
 * @param principal   Loan amount £
 * @param annualRate  Annual interest rate as percentage (e.g. 4.5 for 4.5%)
 * @param termYears   Mortgage term in years
 */
export function monthlyPaymentRepayment(
  principal: number,
  annualRate: number,
  termYears: number,
): number {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Monthly interest-only payment.
 * @param principal   Loan amount £
 * @param annualRate  Annual interest rate as percentage
 */
export function monthlyPaymentInterestOnly(
  principal: number,
  annualRate: number,
): number {
  return (principal * (annualRate / 100)) / 12;
}

// ── Rate sensitivity ladder ───────────────────────────────────────────────────

/**
 * Returns monthly payments at benchmark ±0.5% and ±1.0%.
 * Used for the Calculator market context panel.
 */
export function rateSensitivityLadder(
  principal: number,
  benchmarkRate: number,
  termYears: number,
): Array<{ rate: number; monthly: number; isBenchmark: boolean }> {
  const offsets = [-1.0, -0.5, 0, 0.5, 1.0];
  return offsets.map((offset) => {
    const rate = Math.max(0.01, benchmarkRate + offset);
    return {
      rate,
      monthly: monthlyPaymentRepayment(principal, rate, termYears),
      isBenchmark: offset === 0,
    };
  });
}

// ── Local median comparison ───────────────────────────────────────────────────

/**
 * Property value vs local median, as a percentage difference.
 * Positive = above median, negative = below.
 */
export function vsLocalMedian(propertyValue: number, medianPrice: number): number {
  if (medianPrice <= 0) return 0;
  return ((propertyValue - medianPrice) / medianPrice) * 100;
}

// ── Rate trend ────────────────────────────────────────────────────────────────

/**
 * 12-month change in basis points (current − prior) * 100.
 * Positive = rates rose, negative = rates fell.
 */
export function rateTrendBps(currentRate: number, priorRate: number): number {
  return Math.round((currentRate - priorRate) * 100);
}

// ── Market signal ─────────────────────────────────────────────────────────────

/**
 * Market signal from 12m bps changes on 2yr and 5yr fixed series.
 *   IMPROVING if both ≤ −25 bps
 *   WORSENING if both ≥ +25 bps
 *   else STABLE
 */
export function marketSignalFromBps(
  change2yrBps: number,
  change5yrBps: number,
): MarketSignal {
  if (change2yrBps <= -25 && change5yrBps <= -25) return 'IMPROVING';
  if (change2yrBps >= 25 && change5yrBps >= 25) return 'WORSENING';
  return 'STABLE';
}
