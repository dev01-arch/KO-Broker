/**
 * Bank of England statistical series codes — PRD-15 B1
 *
 * Series IDs sourced from BoE Statistical Interactive Database:
 *   https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp
 *
 * All series are monthly. Data is fetched via the BoE public JSON API:
 *   https://www.bankofengland.co.uk/boeapps/database/index.asp?first.x=yes&SeriesCodes=IUMWTFA&UsingCodes=Y
 *
 * HMLR method (B1 decision, recorded here):
 *   Method chosen: PREFERRED — scheduled job (cron) produces LocalPriceStat rows by
 *   outward code (median, 12m change, 12m txn count) from HMLR Price Paid Data API.
 *
 *   The HMLR SPARQL endpoint at https://landregistry.data.gov.uk/app/qonsole is used
 *   to query aggregated sold prices by outward code (e.g. "SW1A") for the last 12 months.
 *   We store only the aggregate (median, count) — never raw deed rows.
 *
 *   Full national PPD CSV is explicitly ruled out: Vercel/Postgres cannot handle the
 *   ~30M row dataset. Outward-code aggregates are ~3–5 KB per code, feasible at scale.
 *
 *   On-demand fallback: if a snapshot POST references an outward code not yet in
 *   LocalPriceStat, the insight template drops the local-price clause rather than
 *   failing. The next cron run will pick it up.
 */

// ── Series code map ───────────────────────────────────────────────────────────

/**
 * Each entry maps a human label to its BoE series code.
 * These are used by the ingest cron (B3) to fetch and store RateSeriesPoint rows.
 */
export const BOE_SERIES = {
  /**
   * 2-year fixed quoted mortgage rate (75% LTV)
   * BoE series IUMBV42 — "Monthly average of quoted rates on new business
   * 2 year fixed, 75 per cent LTV"
   */
  FIXED_2YR_75LTV: 'IUMBV42',

  /**
   * 5-year fixed quoted mortgage rate (75% LTV)
   * BoE series IUMBV44 — "Monthly average of quoted rates on new business
   * 5 year fixed, 75 per cent LTV"
   */
  FIXED_5YR_75LTV: 'IUMBV44',

  /**
   * 75% LTV variable quoted mortgage rate
   * BoE series IUMBV46 — "Monthly average of quoted rates on new business
   * variable rate, 75 per cent LTV"
   */
  VARIABLE_75LTV: 'IUMBV46',

  /**
   * Effective rate on new mortgages (all types)
   * BoE series IUMWTFA — "Monthly effective rate, new mortgages"
   */
  EFFECTIVE_NEW: 'IUMWTFA',

  /**
   * Effective rate on outstanding mortgage stock
   * BoE series IUMTLMV — "Monthly effective rate, outstanding mortgages"
   */
  EFFECTIVE_OUTSTANDING: 'IUMTLMV',
} as const;

export type BoESeriesKey = keyof typeof BOE_SERIES;
export type BoESeriesCode = (typeof BOE_SERIES)[BoESeriesKey];

/**
 * Human-readable labels for each series — used in Overview cards and sourcesJson.
 */
export const BOE_SERIES_LABELS: Record<BoESeriesKey, string> = {
  FIXED_2YR_75LTV: '2yr Fixed (75% LTV)',
  FIXED_5YR_75LTV: '5yr Fixed (75% LTV)',
  VARIABLE_75LTV: 'Variable Rate (75% LTV)',
  EFFECTIVE_NEW: 'Effective Rate (New)',
  EFFECTIVE_OUTSTANDING: 'Effective Rate (Outstanding)',
};

/**
 * The subset of series shown on the Overview cards.
 * The two "effective" series are background context for market signal computation.
 */
export const OVERVIEW_SERIES: BoESeriesKey[] = [
  'FIXED_2YR_75LTV',
  'FIXED_5YR_75LTV',
  'VARIABLE_75LTV',
  'EFFECTIVE_NEW',
];

/**
 * The two series used to compute marketSignal (12-month trend).
 * Signal = IMPROVING if both change ≤ −25bps; WORSENING if both ≥ +25bps; else STABLE.
 */
export const SIGNAL_SERIES: [BoESeriesKey, BoESeriesKey] = [
  'FIXED_2YR_75LTV',
  'FIXED_5YR_75LTV',
];

/**
 * BoE public data API base URL.
 * Usage: `${BOE_API_BASE}?csv.x=yes&Datefrom=01/Jan/2020&Dateto=now&SeriesCodes=IUMBV42&UsingCodes=Y&CSVF=TT&VPD=Y`
 *
 * Returns CSV/TSV or HTML table of values:
 *   row 0: header "Title, {series label}"
 *   row 1+: "YYYY Mon,value"
 * e.g. "2024 Sep,4.53"
 */
export const BOE_API_BASE =
  'https://www.bankofengland.co.uk/boeapps/database/fromshowcolumns.asp';

/**
 * Build a BoE CSV download URL for a single series.
 * Requests tabular data with titles for the series.
 */
export function buildBoEUrl(seriesCode: string): string {
  const params = new URLSearchParams({
    'csv.x': 'yes',
    'last.x': 'yes',
    Datefrom: '01/Jan/2020',
    Dateto: 'now',
    SeriesCodes: seriesCode,
    UsingCodes: 'Y',
    CSVF: 'TT',
    VPD: 'Y',
  });
  return `${BOE_API_BASE}?${params.toString()}`;
}
