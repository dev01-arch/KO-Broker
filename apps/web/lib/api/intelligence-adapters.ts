/**
 * Wire → view-model adapters for Mortgage Intelligence (PRD-15).
 *
 * Backend owns the wire contract in @ko/types. These functions map those
 * responses onto the presentation shapes in lib/intelligence/types.ts so the
 * components never depend on the transport shape directly.
 *
 * Deliberate reconciliations:
 *  - Backend reports 12-month change in basis points; the UI renders
 *    percentage points, so bps are divided by 100 here.
 *  - Backend's overview omits the effective-new series, so the four-card
 *    scaffold is built here and each card fills in if its series is present.
 *  - Data sources scaffold is built here so BoE / HMLR / FCA lender sync
 *    always render; Last retrieved fills in from feedStatuses when present.
 */

import type {
  CasePreviewResponse,
  CurrentRatesResponse,
  OverviewResponse,
  SnapshotResponse,
} from '@ko/types';
import { BOE_SERIES } from '@/lib/intelligence/boe-series';
import type {
  IntelligenceCasePreview,
  IntelligenceCurrentRates,
  IntelligenceOverview,
  IntelligenceRateCard,
  IntelligenceSnapshot,
} from '@/lib/intelligence/types';

// ── Formatting helpers ────────────────────────────────────────────────────────

/** BoE series are monthly, so cards read "as at Sep 2026". */
function formatMonth(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
}

function formatDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDeltaPts(pts: number): string {
  return `${pts > 0 ? '+' : ''}${pts.toFixed(2)}pts`;
}

// ── Overview ──────────────────────────────────────────────────────────────────

/** The prototype shows four cards; the effective-new slot stays empty until
 *  Backend adds that series to OVERVIEW_SERIES. */
const OVERVIEW_CARDS = [
  {
    id: 'fixed_2yr',
    seriesId: BOE_SERIES.FIXED_2YR_75LTV,
    label: '2yr fixed',
    subtitle: 'BoE quoted benchmark',
  },
  {
    id: 'fixed_5yr',
    seriesId: BOE_SERIES.FIXED_5YR_75LTV,
    label: '5yr fixed',
    subtitle: 'BoE quoted benchmark',
  },
  {
    id: 'variable_75ltv',
    seriesId: BOE_SERIES.VARIABLE_75LTV,
    label: '75% LTV variable',
    subtitle: 'BoE quoted benchmark',
  },
  {
    id: 'effective_new',
    seriesId: BOE_SERIES.EFFECTIVE_NEW,
    label: 'Effective new rate',
    subtitle: 'Actual lending, BoE M&C',
  },
] as const;

/** Three source cards: BoE rates, HMLR prices, FCA lender directory (PRD-16). */
const OVERVIEW_FEEDS = [
  {
    feedId: 'BOE_RATES',
    label: 'Bank of England — quoted rates',
    cadence: 'Daily ingest',
  },
  {
    feedId: 'HMLR_PRICES',
    label: 'HM Land Registry — price paid',
    cadence: 'Daily ingest',
  },
  {
    feedId: 'FCA_LENDERS',
    label: 'FCA — lender directory',
    cadence: 'Monthly',
  },
] as const;

export function toIntelligenceOverview(res: OverviewResponse): IntelligenceOverview {
  const bySeries = new Map(res.rates.map((rate) => [rate.seriesId, rate]));

  const rates: IntelligenceRateCard[] = OVERVIEW_CARDS.map((card) => {
    const wire = bySeries.get(card.seriesId);
    const change12mPts = wire?.change12mBps != null ? wire.change12mBps / 100 : null;

    return {
      id: card.id,
      label: card.label,
      subtitle: card.subtitle,
      valuePct: wire?.value ?? null,
      change12mPts,
      changeLabel:
        change12mPts != null ? `${formatDeltaPts(change12mPts)} vs 12m ago` : null,
      asAt: formatMonth(wire?.asAt),
      tone: change12mPts == null || change12mPts === 0 ? 'neutral' : change12mPts < 0 ? 'good' : 'bad',
    };
  });

  // Summary is built from the figures Backend actually returned — never invented.
  const deltas = rates
    .filter((card) => card.id === 'fixed_2yr' || card.id === 'fixed_5yr')
    .filter((card) => card.change12mPts != null)
    .map((card) => `${card.label} ${formatDeltaPts(card.change12mPts!)}`);

  return {
    rates,
    signal: res.marketSignal,
    signalSummary: deltas.length ? `${deltas.join(' and ')} over the last 12 months.` : null,
    signalMeta: res.marketSignal
      ? 'Bank of England quoted household rates at 75% LTV.'
      : null,
    feeds: OVERVIEW_FEEDS.map((feed) => {
      const wire = res.feedStatuses.find((status) => status.feedId === feed.feedId);
      return {
        feedId: feed.feedId,
        label: feed.label,
        cadence: feed.cadence,
        lastRetrievedLabel: formatDay(wire?.lastSuccessAt),
      };
    }),
    ratesStale: res.feedStatuses.some((feed) => feed.feedId === 'BOE_RATES' && feed.isStale),
    waitingForImport: res.rates.length === 0,
  };
}

// ── Current rates (Calculator panel) ──────────────────────────────────────────

export function toIntelligenceCurrentRates(res: CurrentRatesResponse): IntelligenceCurrentRates {
  return {
    fixed2yrPct: res.fixed2yr?.value ?? null,
    fixed5yrPct: res.fixed5yr?.value ?? null,
    variable75Pct: res.variable75?.value ?? null,
    asAt: formatMonth(res.fixed2yr?.asAt),
    delayed: res.fixed2yr == null,
  };
}

// ── Case preview ──────────────────────────────────────────────────────────────

export function toIntelligenceCasePreview(
  res: CasePreviewResponse,
  caseId: string,
): IntelligenceCasePreview {
  return {
    caseId,
    caseLabel: res.caseLabel,
    postcode: res.postcode,
    propertyValue: res.propertyValue,
    deposit: res.deposit,
    mortgageAmount: res.mortgageAmount,
    termYears: res.termYears,
    grossIncome: res.grossIncome,
    monthlyCommitments: res.monthlyCommitments,
  };
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function toIntelligenceSnapshot(res: SnapshotResponse): IntelligenceSnapshot {
  const outputs = res.outputsJson;
  const sources = res.sourcesJson;
  const local = sources.localPrices;

  const sourceList: { label: string; asAt?: string }[] = [];
  if (sources.rates) {
    sourceList.push({
      label: 'Bank of England quoted rates',
      asAt: formatMonth(sources.rates.asAt) ?? undefined,
    });
  }
  if (local) {
    sourceList.push({
      label: 'HM Land Registry price paid',
      asAt: formatMonth(local.asOf) ?? undefined,
    });
  }
  if (sources.geography) sourceList.push({ label: 'Postcodes.io' });

  return {
    id: res.id,
    caseId: res.caseId,
    source: res.source,
    confirmedAt: res.confirmedAt,
    generatedAt: res.generatedAt,
    postcode: res.postcode,
    outwardCode: res.outwardCode,
    geographyLabel: res.geography.adminDistrict ?? res.geography.region ?? null,
    propertyValue: res.propertyValue,
    deposit: res.deposit,
    mortgageAmount: res.mortgageAmount,
    termYears: res.termYears,
    grossIncome: res.grossIncome,
    secondIncome: res.secondIncome,
    monthlyCommitments: res.monthlyCommitments,
    ltv: res.ltv,
    lti: res.lti,
    dti: res.dti,
    dtiBand: res.dtiBand,
    monthlyPayment: res.monthlyPayment,
    marketSignal: res.marketSignal,
    insightText: res.insightText,
    watchText: res.watchText,
    outputsJson: {
      property: {
        localMedian: local?.medianPrice ?? null,
        change12mPct: local?.change12mPct ?? null,
        txnCount12m: local?.txnCount12m ?? null,
        vsMedianPct: outputs.vsMedianPct,
        noSample: local == null,
      },
      mortgageMarket: {
        fixed2yrPct: outputs.benchmarkRate2yr,
        fixed5yrPct: outputs.benchmarkRate5yr,
        variable75Pct: outputs.benchmarkRateVariable75,
        effectiveNewPct: outputs.effectiveNewRate,
      },
      borrower: {
        ltv: res.ltv,
        lti: res.lti,
        dtiLabel: outputs.dtiBandLabel ?? res.dtiBand ?? null,
        monthlyPayment: res.monthlyPayment,
      },
      ltvBand: {
        applicantLtv: res.ltv,
        referenceBand: outputs.ltvBandLabel ?? null,
        position: null,
        marketRange: null,
      },
    },
    sourcesJson: sourceList,
  };
}
