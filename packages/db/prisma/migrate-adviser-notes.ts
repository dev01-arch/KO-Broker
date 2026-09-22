/**
 * adviserNotes backfill migration — PRD-16 W2
 *
 * For every Case where adviserNotes is non-empty and no ADVISER CaseNote
 * already exists, creates one CaseNote preserving the existing text.
 *
 * Rules:
 *   - Idempotent: skips cases that already have at least one CaseNote
 *     with source = ADVISER (so re-running is safe).
 *   - Does NOT clear Case.adviserNotes — the column stays readable for
 *     one release cycle. New code writes CaseNote only.
 *   - authorUserId is null (origin unknown at migration time).
 *   - createdAt is set to Case.updatedAt so the note appears at the right
 *     point in time rather than the migration run timestamp.
 *   - Non-failing: errors on individual rows are logged and skipped.
 *
 * Run: pnpm --filter @ko/db migrate:adviser-notes
 * Or:  npx tsx prisma/migrate-adviser-notes.ts  (from packages/db)
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

async function main() {
  console.log('🔄 adviserNotes backfill — PRD-16 W2');
  console.log('   Migrating Case.adviserNotes → CaseNote rows...\n');

  // Fetch all cases with non-empty adviserNotes
  const cases = await prisma.case.findMany({
    where: {
      adviserNotes: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      referenceNumber: true,
      adviserNotes: true,
      updatedAt: true,
    },
  });

  const candidates = cases.filter(
    (c) => c.adviserNotes && c.adviserNotes.trim().length > 0,
  );

  console.log(`   Found ${candidates.length} case(s) with non-empty adviserNotes`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of candidates) {
    try {
      // Check if a CaseNote with source=ADVISER already exists for this case
      const existing = await prisma.caseNote.findFirst({
        where: { caseId: c.id, source: 'ADVISER' },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Insert the backfill note, backdated to case.updatedAt
      await prisma.caseNote.create({
        data: {
          orgId: c.orgId,
          caseId: c.id,
          body: c.adviserNotes!,
          tag: null,
          source: 'ADVISER',
          authorUserId: null,
          createdAt: c.updatedAt,
        },
      });

      inserted++;
      console.log(`   ✓ ${c.referenceNumber} — migrated (${c.adviserNotes!.length} chars)`);
    } catch (err) {
      errors++;
      console.error(`   ✗ ${c.referenceNumber} — error:`, err);
    }
  }

  console.log('\n✅ adviserNotes backfill complete');
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped} (CaseNote already existed)`);
  console.log(`   Errors   : ${errors} (logged above)`);
  console.log('\n   Note: Case.adviserNotes column is NOT cleared.');
  console.log('   It remains readable. New code writes CaseNote only.');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
