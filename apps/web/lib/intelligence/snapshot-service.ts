/**
 * Snapshot generation service — PRD-15 B7
 *
 * Flow per PRD-15 §B7:
 *   validate → org/adviser scope → geography lookup → latest rates + local
 *   price stat → run formulas → fill template → banned assert → insert row →
 *   logAuditEvent (CaseIntelligenceSnapshot / CREATED)
 *
 * Hard constraints:
 *   - No live BoE/HMLR HTTP calls here — cache reads only.
 *   - Empty rate cache → throws SnapshotRateDataError (→ 503 RATE_DATA_NOT_READY).
 *   - Snapshots are INSERT-ONLY — never PATCH.
 */

import { prisma } from '@/lib/db';
import type { CaseIntelligenceSnapshot } from '@ko/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { lookupPostcode, toOutwardCode } from './postcode-cache';
import { computeMarketSignal } from './rates-query';
import { BOE_SERIES } from './boe-series';
import { generateInsight } from './insight-templates';
import {
  ltv,
  ltvBand,
  loanToIncome,
  dti,
  monthlyPaymentRepayment,
  vsLocalMedian,
} from '@/lib/calculators/formulas';
import type {
  CreateSnapshotInput,
  SnapshotOutputs,
  SnapshotResponse,
  SnapshotSources,
} from '@ko/types';

// ── Custom error ──────────────────────────────────────────────────────────────

export class SnapshotRateDataError extends Error {
  constructor() {
    super('Rate data is not yet available. Please wait for the first data import.');
    this.name = 'SnapshotRateDataError';
  }
}

// ── Internal: fetch latest rate for a series (cache only) ─────────────────────

async function latestRate(seriesId: string): Promise<{ value: number; validFrom: Date } | null> {
  return prisma.rateSeriesPoint.findFirst({
    where: { seriesId, validTo: null },
    orderBy: { validFrom: 'desc' },
    select: { value: true, validFrom: true },
  });
}

// ── Internal: fetch latest local price stat ───────────────────────────────────

async function latestLocalPriceStat(outwardCode: string) {
  return prisma.localPriceStat.findFirst({
    where: { outwardCode: outwardCode.toUpperCase() },
    orderBy: { asOf: 'desc' },
    select: {
      medianPrice: true,
      medianPrice12m: true,
      change12mPct: true,
      txnCount12m: true,
      asOf: true,
    },
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function createSnapshot(
  input: CreateSnapshotInput,
  orgId: string,
  userId: string,
): Promise<SnapshotResponse> {
  const {
    postcode,
    propertyValue,
    mortgageAmount,
    termYears,
    deposit,
    grossIncome,
    secondIncome,
    monthlyCommitments,
    caseId,
    source,
    confirmedAt,
  } = input;

  // ── 1. Verify case belongs to this org (if provided) ─────────────────────
  if (caseId) {
    const caseRow = await prisma.case.findFirst({
      where: { id: caseId, orgId },
      select: { id: true },
    });
    if (!caseRow) {
      // Treat as 404 — don't leak whether the case exists in another org
      throw Object.assign(new Error('Case not found'), { code: 'NOT_FOUND', status: 404 });
    }
  }

  // ── 2. Geography lookup (B5 — 2s timeout, permanent cache) ───────────────
  const outwardCode = toOutwardCode(postcode);
  const geo = await lookupPostcode(postcode);

  // ── 3. Latest rates from cache (NO live BoE call) ────────────────────────
  const [rate2yr, rate5yr, rateVariable75, rateEffectiveNew] = await Promise.all([
    latestRate(BOE_SERIES.FIXED_2YR_75LTV),
    latestRate(BOE_SERIES.FIXED_5YR_75LTV),
    latestRate(BOE_SERIES.VARIABLE_75LTV),
    latestRate(BOE_SERIES.EFFECTIVE_NEW),
  ]);

  // Empty rate cache → 503. Only the 2yr benchmark is required; the rest are
  // context for the Mortgage market panel and may legitimately be absent.
  if (!rate2yr) {
    throw new SnapshotRateDataError();
  }

  // ── 4. Local price stat (optional — snapshot saves even if absent) ────────
  const priceStat = await latestLocalPriceStat(outwardCode);

  // ── 5. Market signal ──────────────────────────────────────────────────────
  const marketSignal = await computeMarketSignal();

  // ── 6. Run formulas ───────────────────────────────────────────────────────
  const ltvPct = ltv(mortgageAmount, propertyValue);
  // Shared formulas report 'higher' | 'mainstream'; snapshots and the insight
  // templates key off these labels, so map rather than change what is stored.
  const ltvBandLabel: 'HIGH' | 'STANDARD' =
    ltvBand(ltvPct).band === 'higher' ? 'HIGH' : 'STANDARD';

  let ltiRatio: number | null = null;
  let dtiPct: number | null = null;
  let dtiBandLabel: 'WATCH' | 'OK' | null = null;

  const totalIncome = (grossIncome ?? 0) + (secondIncome ?? 0);
  if (totalIncome > 0) {
    ltiRatio = loanToIncome(mortgageAmount, totalIncome);
  }
  if (totalIncome > 0 && monthlyCommitments !== undefined && monthlyCommitments !== null) {
    const dtiResult = dti(monthlyCommitments, totalIncome);
    dtiPct = dtiResult.dtiPct;
    dtiBandLabel = dtiResult.watch ? 'WATCH' : 'OK';
  }

  // Indicative monthly payment always uses the 2yr benchmark (PRD-15 §6.3)
  const monthlyPayment = monthlyPaymentRepayment(mortgageAmount, rate2yr.value, termYears);

  // Local median comparison
  const medianPrice = priceStat?.medianPrice ?? null;
  const vsMedianPct = medianPrice !== null ? vsLocalMedian(propertyValue, medianPrice) : null;

  // Fetch prior 2yr rate for 12m bps change display in template
  let marketSignalChange2yrBps: number | null = null;
  const rate2yr12mAgo = await prisma.rateSeriesPoint.findFirst({
    where: {
      seriesId: BOE_SERIES.FIXED_2YR_75LTV,
      validFrom: {
        lte: new Date(Date.now() - 11 * 30 * 24 * 60 * 60 * 1000),
        gte: new Date(Date.now() - 14 * 30 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { validFrom: 'desc' },
    select: { value: true },
  });
  if (rate2yr12mAgo) {
    marketSignalChange2yrBps = Math.round((rate2yr.value - rate2yr12mAgo.value) * 100);
  }

  // ── 7. Generate insight text ──────────────────────────────────────────────
  const { insightText, watchText } = generateInsight({
    ltvPct,
    ltvBandLabel,
    ltiRatio,
    dtiPct,
    dtiBandLabel,
    monthlyPayment,
    benchmarkRate2yr: rate2yr.value,
    benchmarkRateAsAt: rate2yr.validFrom.toISOString(),
    marketSignal,
    marketSignalChange2yrBps,
    medianPrice,
    vsMedianPct,
    outwardCode,
    adminDistrict: geo?.adminDistrict ?? null,
    propertyValue,
    mortgageAmount,
    termYears,
  });

  // ── 8. Build JSON blobs ───────────────────────────────────────────────────
  const inputsJson = {
    postcode,
    outwardCode,
    propertyValue,
    mortgageAmount,
    termYears,
    deposit: deposit ?? null,
    grossIncome: grossIncome ?? null,
    secondIncome: secondIncome ?? null,
    monthlyCommitments: monthlyCommitments ?? null,
    source,
    confirmedAt: confirmedAt ?? null,
    caseId: caseId ?? null,
  };

  const outputsJson: SnapshotOutputs = {
    ltvPct,
    ltvBandLabel,
    ltiRatio,
    dtiPct,
    dtiBandLabel,
    monthlyPayment,
    marketSignal,
    benchmarkRate2yr: rate2yr.value,
    benchmarkRate5yr: rate5yr?.value ?? null,
    benchmarkRateVariable75: rateVariable75?.value ?? null,
    effectiveNewRate: rateEffectiveNew?.value ?? null,
    vsMedianPct,
  };

  const sourcesJson: SnapshotSources = {
    rates: {
      source: 'BOE_API',
      seriesId: BOE_SERIES.FIXED_2YR_75LTV,
      value: rate2yr.value,
      asAt: rate2yr.validFrom.toISOString(),
    },
    localPrices: priceStat
      ? {
          source: 'HMLR_PPD',
          outwardCode,
          medianPrice: priceStat.medianPrice,
          change12mPct: priceStat.change12mPct,
          txnCount12m: priceStat.txnCount12m,
          asOf: priceStat.asOf.toISOString(),
        }
      : null,
    geography: geo
      ? {
          source: 'POSTCODES_IO',
          region: geo.region,
          adminDistrict: geo.adminDistrict,
        }
      : null,
  };

  // ── 9. INSERT snapshot row (never PATCH) ──────────────────────────────────
  const snapshot = await prisma.caseIntelligenceSnapshot.create({
    data: {
      orgId,
      caseId: caseId ?? null,
      source,
      confirmedAt: confirmedAt ? new Date(confirmedAt) : null,
      postcode,
      outwardCode,
      propertyValue,
      deposit: deposit ?? null,
      mortgageAmount,
      termYears,
      grossIncome: grossIncome ?? null,
      secondIncome: secondIncome ?? null,
      monthlyCommitments: monthlyCommitments ?? null,
      ltv: ltvPct,
      lti: ltiRatio,
      dti: dtiPct,
      dtiBand: dtiBandLabel,
      monthlyPayment,
      marketSignal,
      insightText,
      watchText,
      inputsJson,
      outputsJson,
      sourcesJson,
    },
  });

  // ── 10. Audit log (fire-and-forget) ───────────────────────────────────────
  void logAuditEvent({
    orgId,
    userId,
    entityType: 'CaseIntelligenceSnapshot',
    entityId: snapshot.id,
    action: 'CREATED',
    diff: { after: { source, caseId: caseId ?? null, postcode, orgId } },
  });

  // ── 11. Return fully rendered snapshot ────────────────────────────────────
  return formatSnapshotResponse(snapshot, {
    region: geo?.region ?? null,
    adminDistrict: geo?.adminDistrict ?? null,
    constituency: geo?.constituency ?? null,
  });
}

/**
 * Maps a stored Prisma CaseIntelligenceSnapshot row to the standard SnapshotResponse wire contract.
 * Serializes Date instances to ISO strings and populates the structured geography object.
 */
export async function formatSnapshotResponse(
  snapshot: CaseIntelligenceSnapshot,
  geoOverride?: { region: string | null; adminDistrict: string | null; constituency: string | null },
): Promise<SnapshotResponse> {
  const geo = geoOverride ?? (await lookupPostcode(snapshot.postcode));

  return {
    id: snapshot.id,
    orgId: snapshot.orgId,
    caseId: snapshot.caseId,
    source: snapshot.source,
    confirmedAt: snapshot.confirmedAt?.toISOString() ?? null,
    generatedAt: snapshot.generatedAt.toISOString(),
    postcode: snapshot.postcode,
    outwardCode: snapshot.outwardCode,
    propertyValue: snapshot.propertyValue,
    deposit: snapshot.deposit,
    mortgageAmount: snapshot.mortgageAmount,
    termYears: snapshot.termYears,
    grossIncome: snapshot.grossIncome,
    secondIncome: snapshot.secondIncome,
    monthlyCommitments: snapshot.monthlyCommitments,
    ltv: snapshot.ltv,
    lti: snapshot.lti,
    dti: snapshot.dti,
    dtiBand: snapshot.dtiBand,
    monthlyPayment: snapshot.monthlyPayment,
    marketSignal: snapshot.marketSignal,
    insightText: snapshot.insightText,
    watchText: snapshot.watchText,
    outputsJson: snapshot.outputsJson as SnapshotOutputs,
    sourcesJson: snapshot.sourcesJson as SnapshotSources,
    geography: {
      region: geo?.region ?? null,
      adminDistrict: geo?.adminDistrict ?? null,
      constituency: geo?.constituency ?? null,
    },
  };
}
