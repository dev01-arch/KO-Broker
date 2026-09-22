/**
 * Lender seed script — PRD-16 W0
 *
 * Seeds ~190 unique lender names from Appendix A of PRD-16.
 * - Computes normalizedName (lowercase, stripped punctuation) for deduplication.
 * - Upserts on normalizedName — safe to re-run (idempotent).
 * - Marks legacy/closed brands as LEGACY status.
 * - Ensures the reserved "Other" sentinel row exists with source = OTHER.
 *
 * Run: pnpm --filter @ko/db seed:lenders
 * Or:  npx tsx prisma/seed-lenders.ts  (from packages/db)
 */

import { PrismaClient } from '@prisma/client';

// Use DIRECT_URL (port 5432, no pgbouncer) for seed scripts — same pattern
// as seed-intelligence.ts to avoid pgbouncer statement-level mode issues.
const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
const databaseUrl = rawUrl && !rawUrl.includes('connection_limit')
  ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}connection_limit=1&pool_timeout=60`
  : rawUrl;

const prisma = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
});

// ── Normalise helper ──────────────────────────────────────────────────────────
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Legacy brands — closed but kept for remortgage files ─────────────────────
const LEGACY_NAMES = new Set([
  'Bradford & Bingley',
  'Intelligent Finance',
  'Mortgage Express',
  'NRAM',
]);

// ── All lender names from PRD-16 Appendix A ───────────────────────────────────
// "Other" is intentionally excluded here — it is handled separately as the
// reserved sentinel row with source = OTHER.
const LENDER_NAMES: string[] = [
  'Accord Mortgages',
  'Affirmative',
  'Afin Bank',
  'Ahil United',
  'AIB',
  'Aldermore Bank',
  'Alicja Bank',
  'Al Rayan',
  'Alternative Bridging',
  'April Mortgages',
  'Aria Finance',
  'Aspen Bridging',
  'Aviva',
  'Bank Of China (UK)',
  'Bank of Ireland',
  'Bath Building Society',
  'BC Invest',
  'Bespoke BOI',
  'Beverley Building Society',
  'Birmingham Bank',
  'Black & White Bridging',
  'Bluestone Mortgages',
  'BM Solutions',
  'Bradford & Bingley',
  'Buckinghamshire Building Society',
  'Cabot Financial',
  'CAF Bank',
  'Cambridge Building Society',
  'Canada Life',
  'Castle Trust',
  'Central Trust 1st',
  'Charter Bank',
  'Chaseblue Loans LTD',
  'Chelsea Building Society',
  'CHL Mortgages',
  'Chorley & District Building Society',
  'Clydesdale Bank PLC',
  'Co-operative Bank',
  'Coutts',
  'Coventry BS',
  'Cumberland BS',
  'Cynergy Bank',
  'Danske Bank',
  'Darlington Building Society',
  'Digital Mortgages / Atom bank',
  'Dudley Building Society',
  'Earl Shilton Building Society',
  'Ecology Building Society',
  'Equifinance',
  'Even',
  'Family BS',
  'First Direct',
  'Fleet Mortgages',
  'Foundation Home Loans',
  'Furness Building Society',
  'Gable Mortgages',
  'Gatehouse Bank',
  'Generation Home',
  'Glenhawk',
  'Godiva BTL',
  'Greenfield Mortgages',
  'Habito',
  'Halifax',
  'Hampden & Co',
  'Hampshire Trust Bank',
  'Handelsbanken',
  'Hanley Economic Building Society',
  'Harpenden Building Society',
  'Heliodor',
  'Hodge',
  'Hope Capital',
  'HSBC',
  'Hyalite Mortgages',
  'Intelligent Finance',
  'InterBay',
  'Investec',
  'Jasper Mortgages',
  'Kensington',
  'Kent Reliance Bank',
  'Keystone Property Finance',
  'KSEYE',
  'Kufink',
  'L&G HL',
  'Landbay',
  'Landmark Mortgages',
  'Leeds Building Society',
  'Leek United Building Society',
  'Lendco',
  'LendInvest',
  'LiveMore',
  'Lloyds Bank',
  'Loughborough Building Society',
  'LV — Liverpool Victoria',
  'Mansfield Building Society',
  'Market Harborough Building Society',
  'Marsden Building Society',
  'Masthaven',
  'MBS Lending Ltd',
  'Melanite Mortgages',
  'Melton BS',
  'Metro Bank',
  'MFS',
  'Mint Property Finance',
  'Moda Mortgages',
  'Molo',
  'Monmouthshire Building Society',
  'Morag Finance',
  'More 2 Life',
  'Mortgage Express',
  'MPowered Mortgages',
  'MT Finance',
  'Nationwide Building Society',
  'NatWest',
  'Natwest International',
  'Newbury Building Society',
  'Newcastle Building Society',
  'Nomo Bank',
  'Norton Home Loans',
  'Nottingham Building Society',
  'NRAM',
  'OakNorth Bank',
  'Octane Capital',
  'Octopus Real Estate',
  'Ortus',
  'Oxbury Bank',
  'Paragon',
  'Penrith Building Society',
  'Pepper Money',
  'Perenna',
  'Platform',
  'Post Office',
  'Precise Mortgages',
  'Principality Building Society',
  'Progressive Building Society',
  'Pure Retirement',
  'Quantum Mortgages',
  'Raw Capital',
  'Reliance Bank',
  'Rely',
  'Responsible Life',
  'Roma Finance',
  'Rosinca',
  'Rosolite Mortgages',
  'Royal Bank of Scotland',
  'Saffron BS',
  'Santander',
  'Saxon Trust',
  'Scottish Building Society',
  'Scottish Widows Bank',
  'Secure Trust Bank',
  'Selina Finance',
  'Shawbrook Bank Limited',
  'Skipton Building Society',
  'Skipton International',
  'SoMo',
  'Stafford Railway Building Society',
  'State Bank of India',
  'Step One Finance',
  'Streambank',
  'StrideUp',
  'Suffolk Building Society',
  'Swansea Building Society',
  'Tandem Bank',
  'TBMC',
  'Teachers Building Society',
  'Tenn Capital',
  'TFC Homeloans / All Money Matters',
  'TFG Capital',
  'The Mortgage Lender',
  'The Mortgage Works',
  'Tipton Building Society',
  'Together',
  'Topaz Finance',
  'TSB Bank',
  'Tulip Mortgages',
  'Tuscan Capital',
  'Ultimate Finance',
  'United Trust Bank',
  'Vernon',
  'Vida Homeloans',
  'Virgin Money',
  'Wave Lending',
  'Weatherbys',
  'West Brom',
  'West One',
  'Yorkshire Bank',
  'Yorkshire Building Society',
  'Zephyr Homeloans',
];

async function main() {
  console.log('🌱 Seeding lenders (PRD-16 W0)...');

  let inserted = 0;
  let skipped = 0;
  let legacyCount = 0;

  // ── Upsert each named lender ──────────────────────────────────────────────
  for (const name of LENDER_NAMES) {
    const normalizedName = normalize(name);
    const isLegacy = LEGACY_NAMES.has(name);

    const existing = await prisma.lender.findUnique({ where: { normalizedName } });

    if (existing) {
      // Only update status if this is a legacy brand and it wasn't already set
      if (isLegacy && existing.status !== 'LEGACY') {
        await prisma.lender.update({
          where: { normalizedName },
          data: { status: 'LEGACY' },
        });
        legacyCount++;
      }
      skipped++;
      continue;
    }

    await prisma.lender.create({
      data: {
        name,
        normalizedName,
        status: isLegacy ? 'LEGACY' : 'ACTIVE',
        source: 'SEED',
      },
    });

    if (isLegacy) legacyCount++;
    inserted++;
  }

  // ── Ensure the reserved "Other" sentinel row exists ───────────────────────
  const otherNormalized = normalize('Other');
  const existingOther = await prisma.lender.findUnique({
    where: { normalizedName: otherNormalized },
  });

  if (!existingOther) {
    await prisma.lender.create({
      data: {
        name: 'Other',
        normalizedName: otherNormalized,
        status: 'ACTIVE',
        source: 'OTHER',
      },
    });
    console.log('  ✓ Created reserved "Other" sentinel row');
  } else {
    console.log('  ✓ "Other" sentinel row already exists');
  }

  const total = await prisma.lender.count();

  console.log(`\n✅ Lender seed complete`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped} (already existed)`);
  console.log(`   Legacy   : ${legacyCount} (Bradford & Bingley, NRAM, Mortgage Express, Intelligent Finance)`);
  console.log(`   Total    : ${total} lenders in DB`);
}

main()
  .catch((e) => {
    console.error('❌ Lender seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
