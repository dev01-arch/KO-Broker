/**
 * Insight text template engine — PRD-15 §6.4 / B7
 *
 * Template-generated non-advisory text only.
 * Rules:
 *   - Slots are dropped when the underlying data is missing — never a filled-in guess.
 *   - watchText only emitted when LTV > 75 OR DTI is in the WATCH band.
 *   - No LLM, no OpenRouter, no Azure. This file is the entire "AI".
 *   - All output passes through assertNoBannedPhrases before being returned.
 *
 * Case Intelligence indicative payment always uses the 2yr quoted benchmark,
 * labelled as such. (PRD-15 §6.3)
 */

import type { MarketSignal } from '@ko/types';
import { assertNoBannedPhrases } from './banned-phrases';

// ── Input shape ───────────────────────────────────────────────────────────────

export interface InsightInputs {
  // Borrower metrics
  ltvPct: number | null;
  ltvBandLabel: 'HIGH' | 'STANDARD' | null;
  ltiRatio: number | null;
  dtiPct: number | null;
  dtiBandLabel: 'WATCH' | 'OK' | null;
  monthlyPayment: number | null; // at 2yr benchmark rate

  // Market context
  benchmarkRate2yr: number | null; // pct, e.g. 4.53
  benchmarkRateAsAt: string | null; // ISO date
  marketSignal: MarketSignal | null;
  marketSignalChange2yrBps: number | null;

  // Local property context
  medianPrice: number | null;
  vsMedianPct: number | null;
  outwardCode: string;
  adminDistrict: string | null;

  // Property / case
  propertyValue: number;
  mortgageAmount: number;
  termYears: number;
}

export interface InsightOutput {
  insightText: string;
  watchText: string | null;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtGbp(n: number): string {
  return `£${fmt(Math.round(n))}`;
}

function fmtPct(n: number, decimals = 1): string {
  return `${fmt(n, decimals)}%`;
}

function fmtBps(bps: number): string {
  const abs = Math.abs(bps);
  const dir = bps < 0 ? 'down' : 'up';
  return `${abs} basis point${abs !== 1 ? 's' : ''} ${dir}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'recent data';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return 'recent data';
  }
}

// ── Clause builders ───────────────────────────────────────────────────────────

function ltvClause(inputs: InsightInputs): string | null {
  if (inputs.ltvPct === null) return null;
  return `The loan-to-value ratio is ${fmtPct(inputs.ltvPct)}`;
}

function paymentClause(inputs: InsightInputs): string | null {
  if (inputs.monthlyPayment === null || inputs.benchmarkRate2yr === null) return null;
  const rateLabel = `${fmtPct(inputs.benchmarkRate2yr, 2)} 2-year fixed benchmark (BoE, ${fmtDate(inputs.benchmarkRateAsAt)})`;
  return `At the ${rateLabel}, an indicative repayment figure would be ${fmtGbp(inputs.monthlyPayment)} per month over ${inputs.termYears} years`;
}

function incomeClause(inputs: InsightInputs): string | null {
  if (inputs.ltiRatio === null) return null;
  return `The loan-to-income ratio is ${fmt(inputs.ltiRatio, 1)}×`;
}

function marketClause(inputs: InsightInputs): string | null {
  if (inputs.marketSignal === null) return null;
  const signalMap: Record<MarketSignal, string> = {
    IMPROVING: 'trending down',
    WORSENING: 'trending up',
    STABLE: 'broadly stable',
  };
  const trend = signalMap[inputs.marketSignal];
  const bpsNote =
    inputs.marketSignalChange2yrBps !== null
      ? `, ${fmtBps(inputs.marketSignalChange2yrBps)} over the past 12 months`
      : '';
  return `Quoted 2-year fixed rates are currently ${trend}${bpsNote}`;
}

function localPriceClause(inputs: InsightInputs): string | null {
  if (inputs.medianPrice === null || inputs.vsMedianPct === null) return null;
  const location = inputs.adminDistrict ?? inputs.outwardCode;
  const rel =
    inputs.vsMedianPct > 0
      ? `${fmtPct(Math.abs(inputs.vsMedianPct))} above`
      : inputs.vsMedianPct < 0
        ? `${fmtPct(Math.abs(inputs.vsMedianPct))} below`
        : 'in line with';
  return `The entered property value of ${fmtGbp(inputs.propertyValue)} is ${rel} the ${location} area median of ${fmtGbp(inputs.medianPrice)}`;
}

// ── Watch text ────────────────────────────────────────────────────────────────

function buildWatchText(inputs: InsightInputs): string | null {
  const triggers: string[] = [];

  if (inputs.ltvPct !== null && inputs.ltvPct > 75) {
    triggers.push(`LTV of ${fmtPct(inputs.ltvPct)} is above the 75% standard reference`);
  }

  if (inputs.dtiBandLabel === 'WATCH' && inputs.dtiPct !== null) {
    triggers.push(`debt-to-income ratio of ${fmtPct(inputs.dtiPct)} is in the watch band (≥ 40%)`);
  }

  if (triggers.length === 0) return null;
  return `Note: ${triggers.join('; ')}.`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate insightText and optional watchText from computed inputs.
 * All clauses are optional — dropped when the source data is missing.
 * Output is validated against the banned-phrase list before return.
 */
export function generateInsight(inputs: InsightInputs): InsightOutput {
  const clauses: string[] = [];

  const ltv = ltvClause(inputs);
  if (ltv) clauses.push(ltv);

  const payment = paymentClause(inputs);
  if (payment) clauses.push(payment);

  const income = incomeClause(inputs);
  if (income) clauses.push(income);

  const market = marketClause(inputs);
  if (market) clauses.push(market);

  const localPrice = localPriceClause(inputs);
  if (localPrice) clauses.push(localPrice);

  // Join clauses into a paragraph. Each clause ends with a period.
  const insightText =
    clauses.length > 0
      ? clauses.map((c) => (c.endsWith('.') ? c : `${c}.`)).join(' ')
      : 'No market context data is currently available for this postcode.';

  const watchText = buildWatchText(inputs);

  // ── Compliance assertion ────────────────────────────────────────────────────
  assertNoBannedPhrases(insightText);
  if (watchText) assertNoBannedPhrases(watchText);

  return { insightText, watchText };
}
