/**
 * BoE rate ingest service — PRD-15 B3
 *
 * Fetches the latest monthly rate data for each configured series from the
 * Bank of England public data API, then upserts into RateSeriesPoint and
 * updates DataFeedStatus.
 *
 * Idempotent on (seriesId, validFrom): if a row for this month already exists
 * it is left unchanged. When a new value arrives the previous row's validTo is
 * closed out so there is always exactly one current row per series.
 *
 * Called only from /api/cron/intelligence-rates — never on request paths.
 */

import { prisma } from '@/lib/db';
import { BOE_SERIES, BOE_SERIES_LABELS, buildBoEUrl, type BoESeriesKey } from './boe-series';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestResult {
  series: string;
  status: 'upserted' | 'already_current' | 'skipped' | 'error';
  value?: number;
  validFrom?: string;
  error?: string;
}

export interface BoEIngestReport {
  ranAt: string;
  results: IngestResult[];
  feedStatus: 'success' | 'partial' | 'failure';
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

/**
 * BoE CSV format (tab-delimited when CSVF=TT):
 *   Row 0: "Title\t{series label}"
 *   Row 1+: "YYYY Mon\tvalue"   e.g. "2024 Sep\t4.53"
 *
 * We want the LATEST row (last non-blank data row).
 */
function parseBoECsv(
  csv: string,
  seriesId: string,
): { value: number; validFrom: Date; rawRef: string } | null {
  const lines = csv
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip header row
  const dataLines = lines.slice(1);

  // Walk backwards to find the last non-blank value
  for (let i = dataLines.length - 1; i >= 0; i--) {
    const cols = dataLines[i]!.split('\t');
    if (cols.length < 2) continue;

    const dateStr = cols[0]!.trim(); // e.g. "2024 Sep"
    const valueStr = cols[1]!.trim();
    if (!valueStr || valueStr === '.' || valueStr === 'n/a') continue;

    const value = parseFloat(valueStr);
    if (isNaN(value)) continue;

    // Parse "YYYY Mon" → first day of that month
    const parts = dateStr.split(' ');
    if (parts.length !== 2) continue;
    const year = parseInt(parts[0]!, 10);
    const monthStr = parts[1]!;
    const monthIndex = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ].indexOf(monthStr);
    if (monthIndex === -1 || isNaN(year)) continue;

    const validFrom = new Date(Date.UTC(year, monthIndex, 1));
    return { value, validFrom, rawRef: `${seriesId}@${dateStr}` };
  }

  return null;
}

// ── Fetch one series ──────────────────────────────────────────────────────────

async function fetchOneSeries(
  seriesKey: BoESeriesKey,
): Promise<IngestResult> {
  const seriesId = BOE_SERIES[seriesKey];
  const label = BOE_SERIES_LABELS[seriesKey];

  try {
    const url = buildBoEUrl(seriesId);
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'KO-Broker/1.0 (data@ko-broker.com)' },
    });

    if (!res.ok) {
      return {
        series: seriesId,
        status: 'error',
        error: `HTTP ${res.status} from BoE API`,
      };
    }

    const csv = await res.text();
    const parsed = parseBoECsv(csv, seriesId);

    if (!parsed) {
      return {
        series: seriesId,
        status: 'skipped',
        error: 'No parseable data row in BoE response',
      };
    }

    const { value, validFrom, rawRef } = parsed;

    // ── Idempotency check: is this month already stored? ──────────────────────
    const existing = await prisma.rateSeriesPoint.findFirst({
      where: { seriesId, validFrom },
      select: { id: true },
    });

    if (existing) {
      return {
        series: seriesId,
        status: 'already_current',
        value,
        validFrom: validFrom.toISOString(),
      };
    }

    // ── New data point — close the previous row's validTo ─────────────────────
    await prisma.rateSeriesPoint.updateMany({
      where: { seriesId, validTo: null },
      data: { validTo: validFrom },
    });

    // ── Insert new row ─────────────────────────────────────────────────────────
    await prisma.rateSeriesPoint.create({
      data: {
        seriesId,
        label,
        value,
        validFrom,
        validTo: null,
        retrievedAt: new Date(),
        source: 'BOE_API',
        rawRef,
      },
    });

    return {
      series: seriesId,
      status: 'upserted',
      value,
      validFrom: validFrom.toISOString(),
    };
  } catch (err) {
    return {
      series: seriesId,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the full BoE ingest for all configured series.
 * Always updates DataFeedStatus for feedId 'BOE_RATES' — even on partial failure.
 */
export async function runBoEIngest(): Promise<BoEIngestReport> {
  const ranAt = new Date();

  // ── Check whether this month is already fully ingested (no-op guard) ─────────
  // BoE publishes late in the month so we use a check-and-skip rather than
  // scheduling by day-of-month (which would be brittle).
  const thisMonthStart = new Date(Date.UTC(ranAt.getUTCFullYear(), ranAt.getUTCMonth(), 1));
  const allSeriesIds = Object.values(BOE_SERIES);
  const existingThisMonth = await prisma.rateSeriesPoint.count({
    where: {
      seriesId: { in: allSeriesIds },
      validFrom: thisMonthStart,
    },
  });

  if (existingThisMonth >= allSeriesIds.length) {
    // Everything already ingested this month — update feed status and bail
    await upsertFeedStatus('BOE_RATES', ranAt, null);
    return {
      ranAt: ranAt.toISOString(),
      results: allSeriesIds.map((s) => ({ series: s, status: 'already_current' as const })),
      feedStatus: 'success',
    };
  }

  // ── Fetch all series in parallel ─────────────────────────────────────────────
  const seriesKeys = Object.keys(BOE_SERIES) as BoESeriesKey[];
  const results = await Promise.all(seriesKeys.map(fetchOneSeries));

  const errorResults = results.filter((r) => r.status === 'error');
  const feedStatus =
    errorResults.length === 0
      ? 'success'
      : errorResults.length === results.length
        ? 'failure'
        : 'partial';

  const lastError =
    errorResults.length > 0
      ? errorResults.map((r) => `${r.series}: ${r.error}`).join('; ')
      : null;

  await upsertFeedStatus('BOE_RATES', ranAt, lastError);

  return {
    ranAt: ranAt.toISOString(),
    results,
    feedStatus,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function upsertFeedStatus(
  feedId: string,
  attemptAt: Date,
  lastError: string | null,
): Promise<void> {
  await prisma.dataFeedStatus.upsert({
    where: { feedId },
    create: {
      feedId,
      lastAttemptAt: attemptAt,
      lastSuccessAt: lastError === null ? attemptAt : null,
      lastError,
    },
    update: {
      lastAttemptAt: attemptAt,
      ...(lastError === null ? { lastSuccessAt: attemptAt, lastError: null } : { lastError }),
    },
  });
}
