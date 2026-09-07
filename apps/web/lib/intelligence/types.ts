/**
 * View models for the Mortgage Intelligence UI (PRD-15).
 *
 * The wire contract lives in @ko/types and is owned by Backend. These are the
 * presentation shapes the components render; `lib/api/intelligence-adapters.ts`
 * maps the wire responses onto them.
 */

import type { CreateSnapshotInput, IntelligenceSource, MarketSignal } from '@ko/types';

export type { IntelligenceSource, MarketSignal };

export type PreviewField<T = number | string> = {
  value: T | null;
  present: boolean;
};

export type IntelligenceCasePreview = {
  caseId: string;
  caseLabel: string;
  postcode: PreviewField<string>;
  propertyValue: PreviewField<number>;
  deposit: PreviewField<number>;
  mortgageAmount: PreviewField<number>;
  termYears: PreviewField<number>;
  grossIncome: PreviewField<number>;
  monthlyCommitments: PreviewField<number>;
};

export type IntelligenceRateCard = {
  id: string;
  label: string;
  subtitle: string;
  valuePct: number | null;
  change12mPts: number | null;
  changeLabel: string | null;
  asAt: string | null;
  tone?: 'good' | 'bad' | 'neutral';
};

export type IntelligenceFeedStatus = {
  feedId: string;
  label: string;
  cadence: string;
  lastRetrievedLabel: string | null;
};

export type IntelligenceOverview = {
  rates: IntelligenceRateCard[];
  signal: MarketSignal | null;
  signalSummary: string | null;
  signalMeta: string | null;
  feeds: IntelligenceFeedStatus[];
  ratesStale: boolean;
  waitingForImport: boolean;
};

export type IntelligenceCurrentRates = {
  fixed2yrPct: number | null;
  fixed5yrPct: number | null;
  /** BoE quoted variable rate at 75% LTV — the third slot Backend exposes. */
  variable75Pct: number | null;
  asAt: string | null;
  delayed: boolean;
};

/** Request body is Backend's schema — no second model for it here. */
export type CreateIntelligenceSnapshotInput = CreateSnapshotInput;

export type IntelligenceSnapshot = {
  id: string;
  caseId: string | null;
  source: IntelligenceSource;
  confirmedAt: string | null;
  generatedAt: string;
  postcode: string;
  outwardCode: string;
  geographyLabel: string | null;
  propertyValue: number;
  deposit: number | null;
  mortgageAmount: number;
  termYears: number;
  grossIncome: number | null;
  secondIncome: number | null;
  monthlyCommitments: number | null;
  ltv: number | null;
  lti: number | null;
  dti: number | null;
  dtiBand: string | null;
  monthlyPayment: number | null;
  marketSignal: MarketSignal | null;
  insightText: string;
  watchText: string | null;
  outputsJson: {
    property?: {
      localMedian: number | null;
      change12mPct: number | null;
      txnCount12m: number | null;
      vsMedianPct: number | null;
      noSample?: boolean;
    };
    mortgageMarket?: {
      fixed2yrPct: number | null;
      fixed5yrPct: number | null;
      ltv75FixedPct: number | null;
      effectiveNewPct: number | null;
    };
    borrower?: {
      ltv: number | null;
      lti: number | null;
      dtiLabel: string | null;
      monthlyPayment: number | null;
    };
    ltvBand?: {
      applicantLtv: number | null;
      referenceBand: string | null;
      position: string | null;
      marketRange: string | null;
    };
  };
  sourcesJson: { label: string; asAt?: string }[];
};
