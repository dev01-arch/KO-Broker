/**
 * FCA FS Register verification ingest — PRD-16 W6 (revised)
 *
 * WHAT THIS DOES
 * ==============
 * Verifies that lenders already in the database are still authorised by the FCA.
 * For every lender row that has a known fcaFrn, it calls GET /Firm/{FRN} on the
 * FCA FS Register API and updates lastSeenAt / status accordingly.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ===================================
 * It does NOT attempt to discover new lenders by searching the FCA register.
 * Discovery via keyword search is unreliable — the FCA register returns thousands
 * of brokers, packagers and non-mortgage entities alongside lenders, requiring
 * human review to separate signal from noise.
 *
 * New lenders are added through two human-driven channels instead:
 *   1. The "Other usage report" (GET /api/admin/lenders/other-usage) surfaces
 *      adviser-reported names that appear repeatedly as Other selections.
 *   2. D&E adds confirmed lenders via POST /api/admin/lenders (manual add).
 *
 * WHY THIS APPROACH
 * =================
 * The FCA rate limit (10 req / 10 sec) means a discovery sweep over the full
 * register takes 5–30 minutes — longer than any serverless function timeout.
 * Verification of ~190 known FRNs at 1200ms per request takes ~4 minutes:
 * fast enough for a Supabase Edge Function and well within execution limits.
 * The job is also completely deterministic — the same FRNs every run, no
 * fuzzy name-matching, no guessing, no risk of inserting wrong firms.
 *
 * API: https://register.fca.org.uk/services/V0.1/
 * Auth: X-Auth-Email + X-Auth-Key headers
 * Rate limit: 10 requests per 10 seconds (1200ms delay is conservative)
 * Free registration: https://register.fca.org.uk/developer/s/
 */

import { prisma } from '@/lib/db';

const FCA_API_BASE = 'https://register.fca.org.uk/services/V0.1';
const REQUEST_DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── FCA API types ─────────────────────────────────────────────────────────────

interface FcaFirmDetail {
  Status?: string;
  Data?: Array<{
    'FCA Firm Reference Number': string;
    'Organisation Name': string;
    Status: string;
    'Current Authorisation Status Description': string;
  }>;
}

// ── FCA fetch helper ──────────────────────────────────────────────────────────

async function fcaFetch(path: string): Promise<unknown | null> {
  const email = process.env.FCA_API_EMAIL?.trim();
  const key = process.env.FCA_API_KEY?.trim();

  if (!email || !key) {
    throw new Error(
      'FCA_API_EMAIL and FCA_API_KEY are required. ' +
      'Register free at https://register.fca.org.uk/developer/s/',
    );
  }

  await sleep(REQUEST_DELAY_MS);

  const res = await fetch(`${FCA_API_BASE}${path}`, {
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': key,
      Accept: 'application/json',
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`FCA API ${res.status} on ${path}: ${await res.text()}`);
  }

  return res.json();
}

// ── Stage 1: Verify existing lenders by FRN ──────────────────────────────────

async function verifyExistingLenders(): Promise<{
  verified: number;
  stillActive: number;
  noLongerActive: number;
  notFound: number;
}> {
  const lenders = await prisma.lender.findMany({
    where: {
      fcaFrn: { not: null },
      source: { in: ['SEED', 'FCA'] },
    },
    select: { id: true, name: true, fcaFrn: true, status: true },
  });

  let verified = 0;
  let stillActive = 0;
  let noLongerActive = 0;
  let notFound = 0;
  const now = new Date();

  for (const lender of lenders) {
    if (!lender.fcaFrn) continue;

    try {
      const detail = (await fcaFetch(
        `/Firm/${encodeURIComponent(lender.fcaFrn)}`,
      )) as FcaFirmDetail | null;

      if (!detail?.Data?.[0]) {
        // FRN no longer found in the register at all
        notFound++;
        console.log(`[fca-verify] Not found in register: ${lender.name} (FRN: ${lender.fcaFrn})`);
        continue;
      }

      const firmData = detail.Data[0];
      const statusDesc = firmData['Current Authorisation Status Description']?.toLowerCase() ?? '';
      const isActive = statusDesc.includes('authorised') || firmData.Status?.toLowerCase() === 'authorised';

      // Always update lastSeenAt so we know this FRN was checked this run
      await prisma.lender.update({
        where: { id: lender.id },
        data: { lastSeenAt: now },
      });

      if (isActive) {
        stillActive++;
      } else {
        noLongerActive++;
        console.log(`[fca-verify] No longer active: ${lender.name} (${statusDesc})`);
      }

      verified++;
    } catch (err) {
      console.warn(`[fca-verify] Error checking ${lender.name} (FRN: ${lender.fcaFrn}):`, err);
    }
  }

  return { verified, stillActive, noLongerActive, notFound };
}

// ── Stage 2: Mark long-absent FCA lenders INACTIVE ───────────────────────────

async function markLongAbsentInactive(): Promise<number> {
  // Any FCA-sourced lender whose lastSeenAt has not been refreshed in 32 days
  // (two monthly runs) is considered absent from the register.
  // Hard rules:
  //   - Never touch SEED or OTHER source rows
  //   - Never INACTIVE a lender that has ProductConsidered or Case references
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 32);

  const candidates = await prisma.lender.findMany({
    where: {
      source: 'FCA',
      status: 'ACTIVE',
      lastSeenAt: { lt: cutoff },
    },
    select: { id: true, name: true, fcaFrn: true },
  });

  let marked = 0;
  for (const lender of candidates) {
    // Safety: do not INACTIVE a lender still referenced by active records
    const [prodRefs, caseRefs] = await Promise.all([
      prisma.productConsidered.count({ where: { lenderId: lender.id } }),
      prisma.case.count({ where: { lenderId: lender.id } }),
    ]);

    if (prodRefs > 0 || caseRefs > 0) {
      console.log(`[fca-verify] Skipping INACTIVE for ${lender.name} — has ${prodRefs} product ref(s) and ${caseRefs} case ref(s)`);
      continue;
    }

    await prisma.lender.update({
      where: { id: lender.id },
      data: { status: 'INACTIVE' },
    });
    marked++;
    console.log(`[fca-verify] Marked INACTIVE: ${lender.name} (FRN: ${lender.fcaFrn})`);
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
  lendersWithFrn: number;
  verified: number;
  stillActive: number;
  noLongerActive: number;
  notFound: number;
  markedInactive: number;
  error?: string;
}

export async function runFcaIngest(): Promise<FcaIngestReport> {
  console.log('[fca-verify] Starting FCA lender verification...');

  const lendersWithFrn = await prisma.lender.count({
    where: { fcaFrn: { not: null }, source: { in: ['SEED', 'FCA'] } },
  });
  console.log(`[fca-verify] ${lendersWithFrn} lender(s) with known FRN to verify`);

  try {
    // Run sequentially — markLongAbsentInactive depends on verifyExistingLenders
    // having updated lastSeenAt first
    const verifyResult = await verifyExistingLenders();
    const markedInactive = await markLongAbsentInactive();

    await updateFeedStatus(true);

    const report: FcaIngestReport = {
      feedStatus: 'success',
      lendersWithFrn,
      ...verifyResult,
      markedInactive,
    };

    console.log('[fca-verify] Complete:', report);
    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fca-verify] Failed:', message);
    await updateFeedStatus(false, message);

    return {
      feedStatus: 'failure',
      lendersWithFrn,
      verified: 0,
      stillActive: 0,
      noLongerActive: 0,
      notFound: 0,
      markedInactive: 0,
      error: message,
    };
  }
}
