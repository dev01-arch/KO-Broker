/**
 * FCA FS Register ingest — PRD-16 W6
 *
 * Keeps the lenders table current against the FCA Financial Services Register.
 *
 * API: https://register.fca.org.uk/services/V0.1/
 * Auth: X-Auth-Email + X-Auth-Key headers (free registration at register.fca.org.uk/developer/s/)
 * Rate limit: 10 requests per 10 seconds
 *
 * Strategy:
 *   The FCA API v0.1 does not expose a "list all firms with permission X" bulk endpoint.
 *   Instead we use a two-stage approach:
 *
 *   Stage 1 — Verify existing SEED/FCA lenders
 *     For every lender in the DB that has a fcaFrn, hit GET /Firm/{FRN} to check its
 *     current authorisation status. If it's no longer active we mark it for potential
 *     INACTIVE transition (two-run grace period via lastSeenAt).
 *
 *   Stage 2 — Discover new mortgage lenders
 *     Run a targeted search using terms known to return mortgage lenders
 *     (e.g. "mortgage", "building society", "bank"). For each result, check if the
 *     firm has the "Entering into a regulated mortgage contract" permission.
 *     If yes and it's not in our DB, upsert it as source=FCA.
 *
 * Append-only rules (hard constraints per PRD-16):
 *   - Never rename a row that has ProductConsidered or Case references.
 *   - Never delete any row.
 *   - Two-run grace period before marking INACTIVE (lastSeenAt < now - 32 days).
 *
 * DataFeedStatus: updates feedId='FCA_LENDERS' on every run.
 */

import { prisma } from '@/lib/db';

const FCA_API_BASE = 'https://register.fca.org.uk/services/V0.1';

// Search terms that reliably surface mortgage lenders in the FCA register
const MORTGAGE_SEARCH_TERMS = [
  'mortgage',
  'building society',
  'home loans',
];

// Throttle: 10 req / 10 sec — we use a conservative 1200ms between requests
const REQUEST_DELAY_MS = 1200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeNameForDedup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── FCA API fetch helper ───────────────────────────────────────────────────────

async function fcaFetch(path: string): Promise<unknown | null> {
  const email = process.env.FCA_API_EMAIL?.trim();
  const key = process.env.FCA_API_KEY?.trim();

  if (!email || !key) {
    throw new Error(
      'FCA_API_EMAIL and FCA_API_KEY environment variables are required. ' +
        'Register for a free key at https://register.fca.org.uk/developer/s/',
    );
  }

  const url = `${FCA_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': key,
      Accept: 'application/json',
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`FCA API error ${res.status} for ${path}: ${await res.text()}`);
  }

  return res.json();
}

// ── FCA API types ─────────────────────────────────────────────────────────────

interface FcaFirmSearchResult {
  Status?: string;
  Message?: string;
  ResultInfo?: { page: string; per_page: string; total_count: string };
  Data?: Array<{
    'FCA Firm Reference Number': string;
    'Organisation Name': string;
    Status: string;
  }>;
}

interface FcaFirmDetail {
  Status?: string;
  Data?: Array<{
    'FCA Firm Reference Number': string;
    'Organisation Name': string;
    Status: string;
    'Current Authorisation Status Description': string;
  }>;
}

interface FcaPermissionsResult {
  Status?: string;
  Data?: Array<{ 'Regulated Activity': string }>;
}

// ── Permission check ──────────────────────────────────────────────────────────

async function hasMortgagePermission(frn: string): Promise<boolean> {
  await sleep(REQUEST_DELAY_MS);
  const result = (await fcaFetch(`/Firm/${encodeURIComponent(frn)}/Permissions`)) as FcaPermissionsResult | null;
  if (!result?.Data) return false;
  return result.Data.some(
    (p) => p['Regulated Activity']?.toLowerCase().includes('regulated mortgage contract'),
  );
}

// ── Stage 1: verify existing lenders with fcaFrn ─────────────────────────────

async function verifyExistingLenders(): Promise<{ verified: number; notFound: number }> {
  const existing = await prisma.lender.findMany({
    where: {
      fcaFrn: { not: null },
      source: { in: ['SEED', 'FCA'] },
    },
    select: { id: true, name: true, fcaFrn: true, status: true },
  });

  let verified = 0;
  let notFound = 0;
  const now = new Date();

  for (const lender of existing) {
    if (!lender.fcaFrn) continue;

    try {
      await sleep(REQUEST_DELAY_MS);
      const detail = (await fcaFetch(`/Firm/${encodeURIComponent(lender.fcaFrn)}`)) as FcaFirmDetail | null;

      if (!detail?.Data?.[0]) {
        notFound++;
        continue;
      }

      const firmData = detail.Data[0];
      const isActive = firmData['Current Authorisation Status Description']
        ?.toLowerCase()
        .includes('authorised') ||
        firmData.Status?.toLowerCase() === 'authorised';

      await prisma.lender.update({
        where: { id: lender.id },
        data: {
          lastSeenAt: isActive ? now : lender.status === 'INACTIVE' ? undefined : now,
        },
      });

      verified++;
    } catch (err) {
      console.warn(`[fca-ingest] Could not verify FRN ${lender.fcaFrn} (${lender.name}):`, err);
    }
  }

  return { verified, notFound };
}

// ── Stage 2: discover new mortgage lenders ────────────────────────────────────

async function discoverNewLenders(): Promise<{ inserted: number; alreadyKnown: number }> {
  let inserted = 0;
  let alreadyKnown = 0;

  for (const term of MORTGAGE_SEARCH_TERMS) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      await sleep(REQUEST_DELAY_MS);
      const result = (await fcaFetch(
        `/Firm/Search?q=${encodeURIComponent(term)}&page=${page}`,
      )) as FcaFirmSearchResult | null;

      if (!result?.Data || result.Data.length === 0) {
        hasMore = false;
        break;
      }

      for (const firm of result.Data) {
        const frn = firm['FCA Firm Reference Number'];
        const name = firm['Organisation Name']?.trim();
        if (!frn || !name) continue;

        // Skip firms that are clearly not active lenders
        if (!['Authorised', 'Registered'].includes(firm.Status ?? '')) continue;

        const normalizedName = normalizeNameForDedup(name);

        // Check if already in DB by name or FRN
        const existingByName = await prisma.lender.findUnique({ where: { normalizedName } });
        const existingByFrn = frn
          ? await prisma.lender.findFirst({ where: { fcaFrn: frn } })
          : null;

        if (existingByName || existingByFrn) {
          // Update FRN if we now know it
          if (existingByName && !existingByName.fcaFrn && frn) {
            await prisma.lender.update({
              where: { id: existingByName.id },
              data: { fcaFrn: frn, lastSeenAt: new Date() },
            });
          } else if (existingByFrn) {
            await prisma.lender.update({
              where: { id: existingByFrn.id },
              data: { lastSeenAt: new Date() },
            });
          }
          alreadyKnown++;
          continue;
        }

        // Check if this firm has the mortgage permission before inserting
        const hasMortgage = await hasMortgagePermission(frn);
        if (!hasMortgage) continue;

        // Insert new lender
        try {
          await prisma.lender.create({
            data: {
              name,
              normalizedName,
              fcaFrn: frn,
              status: 'ACTIVE',
              source: 'FCA',
              lastSeenAt: new Date(),
            },
          });
          inserted++;
          console.log(`[fca-ingest] New lender: ${name} (FRN: ${frn})`);
        } catch (err) {
          // Skip duplicates from concurrent upsert race
          console.warn(`[fca-ingest] Could not insert ${name}:`, err);
        }
      }

      // Check for more pages
      const totalCount = parseInt(result.ResultInfo?.total_count ?? '0', 10);
      const perPage = parseInt(result.ResultInfo?.per_page ?? '25', 10);
      hasMore = page * perPage < totalCount;
      page++;
    }
  }

  return { inserted, alreadyKnown };
}

// ── Two-run INACTIVE transition ───────────────────────────────────────────────

async function markLongAbsentInactive(): Promise<number> {
  // Mark ACTIVE FCA-source lenders as INACTIVE if lastSeenAt is older than 32 days
  // (two monthly runs = ~32 days grace period). Never touch SEED or OTHER source rows.
  // Never touch rows with ProductConsidered or Case references — checked by name.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 32);

  const candidates = await prisma.lender.findMany({
    where: {
      source: 'FCA',
      status: 'ACTIVE',
      lastSeenAt: { lt: cutoff },
    },
    select: { id: true, name: true },
  });

  let marked = 0;
  for (const lender of candidates) {
    // Safety check: do not INACTIVE a lender referenced by any product or case
    const hasRefs = await prisma.productConsidered.count({ where: { lenderId: lender.id } });
    const hasCaseRefs = await prisma.case.count({ where: { lenderId: lender.id } });
    if (hasRefs > 0 || hasCaseRefs > 0) continue;

    await prisma.lender.update({
      where: { id: lender.id },
      data: { status: 'INACTIVE' },
    });
    marked++;
    console.log(`[fca-ingest] Marked INACTIVE: ${lender.name}`);
  }

  return marked;
}

// ── DataFeedStatus update ─────────────────────────────────────────────────────

async function updateFeedStatus(success: boolean, error?: string) {
  await prisma.dataFeedStatus.upsert({
    where: { feedId: 'FCA_LENDERS' },
    create: {
      feedId: 'FCA_LENDERS',
      lastAttemptAt: new Date(),
      lastSuccessAt: success ? new Date() : null,
      lastError: error ?? null,
    },
    update: {
      lastAttemptAt: new Date(),
      ...(success ? { lastSuccessAt: new Date(), lastError: null } : { lastError: error }),
    },
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface FcaIngestReport {
  feedStatus: 'success' | 'failure';
  verified: number;
  notFound: number;
  inserted: number;
  alreadyKnown: number;
  markedInactive: number;
  error?: string;
}

export async function runFcaIngest(): Promise<FcaIngestReport> {
  console.log('[fca-ingest] Starting FCA lender sync...');

  try {
    const [verifyResult, discoverResult, markedInactive] = await Promise.all([
      verifyExistingLenders(),
      discoverNewLenders(),
      markLongAbsentInactive(),
    ]);

    await updateFeedStatus(true);

    const report: FcaIngestReport = {
      feedStatus: 'success',
      verified: verifyResult.verified,
      notFound: verifyResult.notFound,
      inserted: discoverResult.inserted,
      alreadyKnown: discoverResult.alreadyKnown,
      markedInactive,
    };

    console.log('[fca-ingest] Complete:', report);
    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fca-ingest] Failed:', message);
    await updateFeedStatus(false, message);
    return {
      feedStatus: 'failure',
      verified: 0,
      notFound: 0,
      inserted: 0,
      alreadyKnown: 0,
      markedInactive: 0,
      error: message,
    };
  }
}
