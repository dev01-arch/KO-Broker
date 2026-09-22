/**
 * FactFind propertyDetails → Property backfill — PRD-16 W3
 *
 * For every Case that:
 *   - has a FactFind with a parseable propertyDetails blob containing a postcode
 *   - does NOT already have a propertyId set
 *
 * Creates one Property row (org-scoped, client-owned) and links it to the case.
 *
 * Rules:
 *   - Best-effort: JSON parse failures, missing postcodes, and DB errors on
 *     individual rows are logged and skipped. The migration never fails.
 *   - Idempotent: skips cases that already have propertyId set.
 *   - Does NOT modify FactFind.propertyDetails — the JSON blob stays as-is.
 *   - RESIDENTIAL type by default; currentValue from case.propertyValue if set.
 *
 * Run: pnpm --filter @ko/db migrate:property-backfill
 * Or:  npx tsx prisma/migrate-property-backfill.ts  (from packages/db)
 */

import { PrismaClient } from '@prisma/client';

const rawUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
const databaseUrl =
  rawUrl && !rawUrl.includes('connection_limit')
    ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}connection_limit=1&pool_timeout=60`
    : rawUrl;

const prisma = new PrismaClient({
  datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
});

function extractPostcode(propertyDetails: unknown): string | null {
  if (!propertyDetails || typeof propertyDetails !== 'object') return null;
  const pd = propertyDetails as Record<string, unknown>;

  // Try direct postcode field
  if (typeof pd.postcode === 'string' && pd.postcode.trim()) {
    return pd.postcode.trim().toUpperCase();
  }

  // Try nested address object
  if (pd.address && typeof pd.address === 'object') {
    const addr = pd.address as Record<string, unknown>;
    if (typeof addr.postcode === 'string' && addr.postcode.trim()) {
      return addr.postcode.trim().toUpperCase();
    }
  }

  // Try currentAddress nested object (some wizard shapes)
  if (pd.currentAddress && typeof pd.currentAddress === 'object') {
    const ca = pd.currentAddress as Record<string, unknown>;
    if (typeof ca.postcode === 'string' && ca.postcode.trim()) {
      return ca.postcode.trim().toUpperCase();
    }
  }

  return null;
}

async function main() {
  console.log('🏠 Property backfill — PRD-16 W3');
  console.log('   Migrating FactFind.propertyDetails → Property rows...\n');

  const cases = await prisma.case.findMany({
    where: { propertyId: null },
    select: {
      id: true,
      orgId: true,
      clientId: true,
      referenceNumber: true,
      propertyValue: true,
      factFind: { select: { propertyDetails: true } },
    },
  });

  console.log(`   Found ${cases.length} case(s) without a propertyId`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of cases) {
    try {
      if (!c.factFind?.propertyDetails) {
        skipped++;
        continue;
      }

      const postcode = extractPostcode(c.factFind.propertyDetails);
      if (!postcode) {
        skipped++;
        continue;
      }

      // Create Property and link to Case in a transaction
      await prisma.$transaction(async (tx) => {
        const property = await tx.property.create({
          data: {
            orgId: c.orgId,
            clientId: c.clientId,
            postcode,
            type: 'RESIDENTIAL',
            currentValue: c.propertyValue ?? null,
            address: (c.factFind!.propertyDetails as Record<string, unknown>).address ?? undefined,
          },
          select: { id: true },
        });

        await tx.case.update({
          where: { id: c.id },
          data: { propertyId: property.id },
        });
      });

      inserted++;
      console.log(`   ✓ ${c.referenceNumber} — postcode: ${postcode}`);
    } catch (err) {
      errors++;
      console.error(`   ✗ ${c.referenceNumber} — error:`, err);
    }
  }

  console.log('\n✅ Property backfill complete');
  console.log(`   Inserted : ${inserted} Property rows`);
  console.log(`   Skipped  : ${skipped} (no propertyDetails or no postcode)`);
  console.log(`   Errors   : ${errors} (logged above)`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
