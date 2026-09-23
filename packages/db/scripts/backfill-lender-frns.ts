/**
 * Backfill FCA FRNs from a CSV file
 *
 * CSV format:
 *   name,fcaFrn
 *   Lloyds Bank,119278
 *   Nationwide Building Society,106078
 *   ...
 *
 * Usage:
 *   cd packages/db
 *   npx tsx scripts/backfill-lender-frns.ts /path/to/lenders-with-frns.csv
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

interface LenderFrnRow {
  name: string;
  fcaFrn: string;
}

function parseCsv(filePath: string): LenderFrnRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  const header = lines[0];
  
  if (!header.includes('name') || !header.includes('fcaFrn')) {
    throw new Error('CSV must have columns: name,fcaFrn');
  }

  return lines
    .slice(1)
    .map((line) => {
      const [name, fcaFrn] = line.split(',').map((s) => s.trim());
      return { name, fcaFrn };
    })
    .filter((row) => row.name && row.fcaFrn);
}

async function backfillFrns(csvPath: string) {
  const rows = parseCsv(csvPath);
  console.log(`[backfill] Loaded ${rows.length} rows from CSV`);

  let updated = 0;
  let notFound = 0;
  let alreadySet = 0;

  for (const row of rows) {
    const lender = await prisma.lender.findFirst({
      where: {
        name: { equals: row.name, mode: 'insensitive' },
      },
      select: { id: true, name: true, fcaFrn: true },
    });

    if (!lender) {
      console.warn(`[backfill] Not found: "${row.name}"`);
      notFound++;
      continue;
    }

    if (lender.fcaFrn) {
      console.log(`[backfill] Already has FRN: ${lender.name} (${lender.fcaFrn})`);
      alreadySet++;
      continue;
    }

    await prisma.lender.update({
      where: { id: lender.id },
      data: {
        fcaFrn: row.fcaFrn,
        lastSeenAt: new Date(),
      },
    });

    console.log(`✓ ${lender.name} → FRN ${row.fcaFrn}`);
    updated++;
  }

  console.log(`\n[backfill] Summary:`);
  console.log(`  Updated:     ${updated}`);
  console.log(`  Not found:   ${notFound}`);
  console.log(`  Already set: ${alreadySet}`);

  await prisma.$disconnect();
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: npx tsx scripts/backfill-lender-frns.ts <path-to-csv>');
  process.exit(1);
}

backfillFrns(csvPath).catch((err) => {
  console.error('[backfill] Error:', err);
  process.exit(1);
});
