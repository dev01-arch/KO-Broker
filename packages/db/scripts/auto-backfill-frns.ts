/**
 * Auto-backfill FCA FRNs for lenders without one
 *
 * Searches the FCA FS Register API for each lender name and updates the FRN
 * automatically. Respects the 10 req/10s rate limit with 1200ms delays.
 *
 * Usage:
 *   cd packages/db
 *   npx tsx scripts/auto-backfill-frns.ts
 *
 * Requires FCA_API_EMAIL and FCA_API_KEY in environment.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const FCA_API_BASE = 'https://register.fca.org.uk/services/V0.1';
const REQUEST_DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FcaSearchResult {
  Data?: Array<{
    'FCA Firm Reference Number': string;
    'Organisation Name': string;
    Status: string;
  }>;
}

async function fcaSearch(name: string): Promise<string | null> {
  const email = process.env.FCA_API_EMAIL?.trim();
  const key = process.env.FCA_API_KEY?.trim();

  if (!email || !key) {
    throw new Error(
      'FCA_API_EMAIL and FCA_API_KEY are required. ' +
        'Register free at https://register.fca.org.uk/developer/s/',
    );
  }

  await sleep(REQUEST_DELAY_MS);

  const res = await fetch(`${FCA_API_BASE}/Firm/Search?q=${encodeURIComponent(name)}`, {
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': key,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    console.warn(`[fca] ${res.status} for "${name}"`);
    return null;
  }

  const data: FcaSearchResult = await res.json();
  const firms = data.Data || [];

  // Try exact name match first (case-insensitive)
  const exact = firms.find(
    (f) =>
      f['Organisation Name']?.toLowerCase() === name.toLowerCase() &&
      f.Status === 'Authorised',
  );

  if (exact) {
    return exact['FCA Firm Reference Number'];
  }

  // Try fuzzy match — name contains the search term or vice versa
  const fuzzy = firms.find(
    (f) =>
      f.Status === 'Authorised' &&
      (f['Organisation Name']?.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(f['Organisation Name']?.toLowerCase())),
  );

  if (fuzzy) {
    console.log(`[fca] Fuzzy match for "${name}": "${fuzzy['Organisation Name']}"`);
    return fuzzy['FCA Firm Reference Number'];
  }

  return null;
}

async function autoBackfillFrns() {
  const lenders = await prisma.lender.findMany({
    where: {
      fcaFrn: null,
      source: { in: ['SEED'] },
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  console.log(`[backfill] ${lenders.length} lender(s) without FRN`);
  console.log(`[backfill] Estimated time: ~${Math.ceil((lenders.length * REQUEST_DELAY_MS) / 1000 / 60)} minutes\n`);

  let updated = 0;
  let notFound = 0;
  const notFoundNames: string[] = [];

  for (const lender of lenders) {
    try {
      const frn = await fcaSearch(lender.name);

      if (frn) {
        await prisma.lender.update({
          where: { id: lender.id },
          data: {
            fcaFrn: frn,
            lastSeenAt: new Date(),
          },
        });
        console.log(`✓ ${lender.name} → FRN ${frn}`);
        updated++;
      } else {
        console.warn(`✗ Not found: ${lender.name}`);
        notFound++;
        notFoundNames.push(lender.name);
      }
    } catch (err) {
      console.error(`✗ Error for ${lender.name}:`, err instanceof Error ? err.message : String(err));
      notFound++;
      notFoundNames.push(lender.name);
    }
  }

  console.log(`\n[backfill] Summary:`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Not found: ${notFound}`);

  if (notFoundNames.length > 0) {
    console.log(`\n[backfill] Not found (manual review needed):`);
    notFoundNames.forEach((name) => console.log(`  - ${name}`));
  }

  await prisma.$disconnect();
}

autoBackfillFrns().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
