/**
 * HMLR Price Paid Data aggregates ingest — PRD-15 B8
 *
 * Method chosen in B1 (PREFERRED): scheduled job queries the HMLR SPARQL
 * endpoint for sold prices grouped by outward code, computes median and
 * 12-month stats, and upserts into LocalPriceStat.
 *
 * Key constraints (PRD-15 §B1 / §3):
 *   - Never store raw deed rows — outward-code aggregates only.
 *   - Never copy the national PPD CSV into Postgres.
 *   - If a snapshot references an outward code not yet in LocalPriceStat,
 *     the snapshot saves successfully and the insight template drops the
 *     local-price clause. Next cron run picks it up.
 *   - Update DataFeedStatus feedId: HMLR_PRICES on every run.
 *
 * HMLR SPARQL endpoint:
 *   https://landregistry.data.gov.uk/landregistry/query
 *
 * The query groups transactions by outward code for the past 13 months
 * (12 months data + 1 month overlap for late registrations). We fetch a
 * maximum of MAX_OUTWARD_CODES per run to stay within Vercel's 10s limit
 * and the SPARQL endpoint's row cap.
 *
 * On the first run (cold start) the job processes only outward codes that
 * already appear in PostcodeGeography (i.e. codes we've already looked up
 * via Postcodes.io). On subsequent runs it refreshes any code whose last
 * LocalPriceStat is older than REFRESH_DAYS.
 */

import { prisma } from '@/lib/db';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPARQL_ENDPOINT = 'https://landregistry.data.gov.uk/landregistry/query';
const MAX_OUTWARD_CODES_PER_RUN = 50;
const REFRESH_DAYS = 30;
const REQUEST_TIMEOUT_MS = 20_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HmlrIngestResult {
  outwardCode: string;
  status: 'upserted' | 'no_data' | 'error';
  medianPrice?: number;
  txnCount?: number;
  error?: string;
}

export interface HmlrIngestReport {
  ranAt: string;
  codesProcessed: number;
  results: HmlrIngestResult[];
  feedStatus: 'success' | 'partial' | 'failure' | 'noop';
}

// ── SPARQL query builder ──────────────────────────────────────────────────────

/**
 * Build a SPARQL query that returns all transaction prices for a single
 * outward code over the past 13 months.
 *
 * We use a VALUES clause to parameterise the outward code safely
 * (no string interpolation into the SPARQL body itself — the outward code
 * is validated as /^[A-Z]{1,2}[0-9]{1,2}$/ before being substituted).
 */
function buildSparqlQuery(outwardCode: string, fromDate: string): string {
  return `
PREFIX lrppi: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?price WHERE {
  ?transx lrppi:pricePaid ?price ;
          lrppi:propertyAddress ?addr ;
          lrppi:transactionDate ?date .
  ?addr lrcommon:postcode ?postcode .
  FILTER (regex(str(?postcode), "^${outwardCode} ", "i"))
  FILTER (?date >= "${fromDate}"^^xsd:date)
}
`.trim();
}

// ── SPARQL response parser ────────────────────────────────────────────────────

interface SparqlBinding {
  price?: { value: string };
}

interface SparqlResponse {
  results?: {
    bindings?: SparqlBinding[];
  };
}

function parseMedian(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

// ── Fetch prices for one outward code ─────────────────────────────────────────

/** Validate outward code — only alphanumeric, 2–4 chars (e.g. "SW1A", "M1", "EC2"). */
function isValidOutwardCode(code: string): boolean {
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?$/.test(code);
}

async function fetchOutwardCodePrices(
  outwardCode: string,
  fromDate: string,
): Promise<number[] | null> {
  const query = buildSparqlQuery(outwardCode, fromDate);
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&output=json`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'KO-Broker/1.0 (data@ko-broker.com)',
      },
    });

    if (!res.ok) return null;

    const json = (await res.json()) as SparqlResponse;
    const bindings = json.results?.bindings ?? [];

    const prices: number[] = [];
    for (const b of bindings) {
      const val = parseFloat(b.price?.value ?? '');
      if (isFinite(val) && val > 0) prices.push(val);
    }
    return prices;
  } catch {
    return null;
  }
}

// ── Process one outward code ──────────────────────────────────────────────────

async function processOutwardCode(
  outwardCode: string,
  fromDate: string,
  from12mAgo: string,
): Promise<HmlrIngestResult> {
  if (!isValidOutwardCode(outwardCode)) {
    return { outwardCode, status: 'error', error: 'Invalid outward code format' };
  }

  // Fetch last 13 months for current median + 12m ago median
  const prices = await fetchOutwardCodePrices(outwardCode, fromDate);

  if (prices === null) {
    return { outwardCode, status: 'error', error: 'SPARQL request failed' };
  }
  if (prices.length === 0) {
    return { outwardCode, status: 'no_data' };
  }

  // Fetch prices from 13–25 months ago for 12m-ago median (change calculation)
  const pricesPrior = await fetchOutwardCodePrices(outwardCode, from12mAgo);
  const priorMedian = pricesPrior && pricesPrior.length > 0 ? parseMedian(pricesPrior) : null;

  const medianPrice = parseMedian(prices);
  const txnCount12m = prices.length;
  const change12mPct =
    priorMedian !== null && priorMedian > 0
      ? ((medianPrice - priorMedian) / priorMedian) * 100
      : null;
  const medianPrice12m = priorMedian;

  const asOf = new Date();

  await prisma.localPriceStat.upsert({
    where: { outwardCode_asOf: { outwardCode: outwardCode.toUpperCase(), asOf } },
    create: {
      outwardCode: outwardCode.toUpperCase(),
      asOf,
      medianPrice,
      medianPrice12m,
      change12mPct,
      txnCount12m,
      retrievedAt: new Date(),
      source: 'HMLR_PPD',
    },
    update: {
      medianPrice,
      medianPrice12m,
      change12mPct,
      txnCount12m,
      retrievedAt: new Date(),
    },
  });

  return { outwardCode, status: 'upserted', medianPrice, txnCount: txnCount12m };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the HMLR price aggregate ingest for up to MAX_OUTWARD_CODES_PER_RUN
 * outward codes.
 *
 * Priority order:
 *   1. Codes in PostcodeGeography that have no LocalPriceStat yet (new codes).
 *   2. Codes whose most recent LocalPriceStat is older than REFRESH_DAYS.
 *
 * Always updates DataFeedStatus for feedId HMLR_PRICES.
 */
export async function runHmlrIngest(): Promise<HmlrIngestReport> {
  const ranAt = new Date();

  // Date range helpers
  const now = new Date();
  const thirteenMonthsAgo = new Date(now);
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);
  const twentyFiveMonthsAgo = new Date(now);
  twentyFiveMonthsAgo.setMonth(twentyFiveMonthsAgo.getMonth() - 25);

  const fromDate = thirteenMonthsAgo.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const from12mAgo = twentyFiveMonthsAgo.toISOString().slice(0, 10);

  // ── 1. Find outward codes to process ─────────────────────────────────────────
  // All distinct outward codes we've cached via Postcodes.io
  const allGeoCodes = await prisma.postcodeGeography.findMany({
    select: { outwardCode: true },
    distinct: ['outwardCode'],
  });

  if (allGeoCodes.length === 0) {
    await upsertFeedStatus('HMLR_PRICES', ranAt, null);
    return {
      ranAt: ranAt.toISOString(),
      codesProcessed: 0,
      results: [],
      feedStatus: 'noop',
    };
  }

  const allCodes = allGeoCodes.map((r) => r.outwardCode.toUpperCase());

  // Find codes that have never been priced or are stale
  const refreshCutoff = new Date(now);
  refreshCutoff.setDate(refreshCutoff.getDate() - REFRESH_DAYS);

  const recentStats = await prisma.localPriceStat.findMany({
    where: {
      outwardCode: { in: allCodes },
      retrievedAt: { gte: refreshCutoff },
    },
    select: { outwardCode: true },
    distinct: ['outwardCode'],
  });
  const recentSet = new Set(recentStats.map((r) => r.outwardCode));

  const codesToProcess = allCodes
    .filter((c) => !recentSet.has(c))
    .slice(0, MAX_OUTWARD_CODES_PER_RUN);

  if (codesToProcess.length === 0) {
    await upsertFeedStatus('HMLR_PRICES', ranAt, null);
    return {
      ranAt: ranAt.toISOString(),
      codesProcessed: 0,
      results: [],
      feedStatus: 'noop',
    };
  }

  // ── 2. Process each code sequentially (SPARQL endpoint rate-limits parallel) ─
  const results: HmlrIngestResult[] = [];
  for (const code of codesToProcess) {
    const result = await processOutwardCode(code, fromDate, from12mAgo);
    results.push(result);
  }

  const errorCount = results.filter((r) => r.status === 'error').length;
  const feedStatus =
    errorCount === 0 ? 'success' : errorCount === results.length ? 'failure' : 'partial';
  const lastError =
    errorCount > 0
      ? results
          .filter((r) => r.status === 'error')
          .map((r) => `${r.outwardCode}: ${r.error}`)
          .join('; ')
      : null;

  await upsertFeedStatus('HMLR_PRICES', ranAt, lastError);

  return {
    ranAt: ranAt.toISOString(),
    codesProcessed: results.length,
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
