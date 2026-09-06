/**
 * Rate cache query helpers — PRD-15 B4
 *
 * Read-only. All queries hit RateSeriesPoint (our local cache) only.
 * Never calls BoE live on a request path — that is the cron's job.
 *
 * marketSignal logic (§6.3):
 *   IMPROVING if both 2yr AND 5yr 12m change ≤ −25 bps
 *   WORSENING if both 2yr AND 5yr 12m change ≥ +25 bps
 *   else STABLE
 */

import { prisma } from '@/lib/db';
import { type MarketSignal } from '@ko/types';
import {
  BOE_SERIES,
  OVERVIEW_SERIES,
  SIGNAL_SERIES,
  BOE_SERIES_LABELS,
  type BoESeriesKey,
} from './boe-series';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Fetch the single most recent (validTo = null) row for a series, or null. */
async function currentPoint(
  seriesId: string,
): Promise<{ value: number; validFrom: Date } | null> {
  const row = await prisma.rateSeriesPoint.findFirst({
    where: { seriesId, validTo: null },
    orderBy: { validFrom: 'desc' },
    select: { value: true, validFrom: true },
  });
  return row ?? null;
}

/**
 * Fetch the point whose validFrom was closest to ~12 months ago.
 * We look for the latest row with validFrom ≤ (now − 11.5 months) to handle
 * BoE's late-month publish schedule without over-looking back.
 */
async function pointTwelveMonthsAgo(
  seriesId: string,
): Promise<{ value: number } | null> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 12);
  // Allow ±2 months tolerance
  const lowerBound = new Date(cutoff);
  lowerBound.setMonth(lowerBound.getMonth() - 2);

  const row = await prisma.rateSeriesPoint.findFirst({
    where: {
      seriesId,
      validFrom: { gte: lowerBound, lte: cutoff },
    },
    orderBy: { validFrom: 'desc' },
    select: { value: true },
  });
  return row ?? null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RateCardData {
  seriesId: string;
  label: string;
  value: number;
  change12mBps: number | null;
  asAt: string; // ISO date string
}

/**
 * Load the overview rate cards for the three headline series.
 * Returns an empty array (not fake data) if no rows exist yet.
 */
export async function getOverviewRateCards(): Promise<RateCardData[]> {
  const cards: RateCardData[] = [];

  for (const key of OVERVIEW_SERIES) {
    const seriesId = BOE_SERIES[key];
    const label = BOE_SERIES_LABELS[key];

    const current = await currentPoint(seriesId);
    if (!current) continue; // no data yet — honest omission, not fake 0

    const ago = await pointTwelveMonthsAgo(seriesId);
    const change12mBps =
      ago !== null ? Math.round((current.value - ago.value) * 100) : null;

    cards.push({
      seriesId,
      label,
      value: current.value,
      change12mBps,
      asAt: current.validFrom.toISOString(),
    });
  }

  return cards;
}

/**
 * Compute the market signal from the two signal series (2yr + 5yr fixed).
 * Returns null when either series has no data.
 */
export async function computeMarketSignal(): Promise<MarketSignal | null> {
  const [key2yr, key5yr] = SIGNAL_SERIES;

  const [current2yr, current5yr] = await Promise.all([
    currentPoint(BOE_SERIES[key2yr]),
    currentPoint(BOE_SERIES[key5yr]),
  ]);

  if (!current2yr || !current5yr) return null;

  const [ago2yr, ago5yr] = await Promise.all([
    pointTwelveMonthsAgo(BOE_SERIES[key2yr]),
    pointTwelveMonthsAgo(BOE_SERIES[key5yr]),
  ]);

  if (!ago2yr || !ago5yr) return null;

  const change2yr = (current2yr.value - ago2yr.value) * 100; // bps
  const change5yr = (current5yr.value - ago5yr.value) * 100;

  if (change2yr <= -25 && change5yr <= -25) return 'IMPROVING';
  if (change2yr >= 25 && change5yr >= 25) return 'WORSENING';
  return 'STABLE';
}

export interface FeedStatusData {
  feedId: string;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  isStale: boolean;
}

/** Load DataFeedStatus rows for the two intel feeds. */
export async function getIntelFeedStatuses(): Promise<FeedStatusData[]> {
  const FEED_IDS = ['BOE_RATES', 'HMLR_PRICES'];
  const STALE_THRESHOLD_DAYS = 45;

  const rows = await prisma.dataFeedStatus.findMany({
    where: { feedId: { in: FEED_IDS } },
    select: {
      feedId: true,
      lastSuccessAt: true,
      lastAttemptAt: true,
      lastError: true,
    },
  });

  const now = Date.now();
  const rowMap = new Map(rows.map((r) => [r.feedId, r]));

  return FEED_IDS.map((feedId) => {
    const row = rowMap.get(feedId);
    if (!row) {
      return {
        feedId,
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        isStale: true, // never run = stale
      };
    }
    const daysSinceSuccess = row.lastSuccessAt
      ? (now - row.lastSuccessAt.getTime()) / 86_400_000
      : Infinity;
    return {
      feedId: row.feedId,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      lastError: row.lastError ?? null,
      isStale: daysSinceSuccess > STALE_THRESHOLD_DAYS,
    };
  });
}

export interface CurrentRatesData {
  fixed2yr: { value: number; asAt: string } | null;
  fixed5yr: { value: number; asAt: string } | null;
  variable75: { value: number; asAt: string } | null;
}

/**
 * Slim payload for the Calculator market context panel.
 * Returns nulls (not fake values) when data is absent.
 */
export async function getCurrentRates(): Promise<CurrentRatesData> {
  const keyMap: Record<string, BoESeriesKey> = {
    fixed2yr: 'FIXED_2YR_75LTV',
    fixed5yr: 'FIXED_5YR_75LTV',
    variable75: 'VARIABLE_75LTV',
  };

  const entries = await Promise.all(
    (Object.entries(keyMap) as [string, BoESeriesKey][]).map(async ([slot, seriesKey]) => {
      const point = await currentPoint(BOE_SERIES[seriesKey]);
      return [slot, point ? { value: point.value, asAt: point.validFrom.toISOString() } : null] as const;
    }),
  );

  return Object.fromEntries(entries) as CurrentRatesData;
}
