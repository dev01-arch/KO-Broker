# FCA FRN Backfill — Manual Process

## Status

Auto-backfill via the FCA Search API failed — the `/Firm/Search` endpoint returned "Invalid Input" for all queries. The `/Firm/{FRN}` lookup endpoint works correctly (used by the monthly verification cron), but discovery via search requires the FCA web UI.

## Why FRNs Matter

The monthly verification cron only checks lenders that have a known `fcaFrn`. Out of 189 seed lenders, 188 currently have `fcaFrn = null`. Without FRNs, the verification cron cannot confirm these lenders are still authorised.

Backfilling FRNs enables:
- Full coverage for the monthly verification run
- Automatic detection when a lender loses authorisation
- Automatic `INACTIVE` marking after 32-day grace period

## The Manual Process

**Quick Start:** Use the ready-to-run SQL script in `Doc/FCA-FRN-Backfill-Top-20-SQL.md`. It backfills the top 20 UK lenders in one go. Takes ~2 seconds to run in Supabase Dashboard → SQL Editor.

For additional lenders beyond the top 20, follow this process:

### Step 1 — Identify lenders without FRN

Run this in the Supabase Dashboard → SQL Editor:

```sql
SELECT name
FROM lenders
WHERE fca_frn IS NULL
  AND source IN ('SEED')
ORDER BY name;
```

Copy the results and paste into a CSV file with two columns: `name,fcaFrn`

Example:

```csv
name,fcaFrn
Accord Mortgages,
Affirmative,
Afin Bank,
...
```

### Step 2 — Look up FRNs manually

For each lender name:

1. Go to [register.fca.org.uk](https://register.fca.org.uk/s/)
2. Search for the lender name
3. Open the firm page
4. Copy the **FCA Firm Reference Number** (6-7 digit number)
5. Paste it into the CSV next to the lender name

**Important:** Not all seed names will have an exact match. Some are:
- Abbreviated (e.g. "Coventry BS" → "Coventry Building Society")
- Trade names (e.g. "First Direct" → "HSBC UK Bank plc trading as first direct")
- Closed brands (e.g. "Bradford & Bingley" → no longer authorised, leave blank)
- Non-FCA entities (e.g. "Even", "Habito" — technology platforms, not lenders)

For lenders you cannot find or that are not authorised, leave the `fcaFrn` column blank.

### Step 3 — Load the FRNs via SQL

**Recommended approach:** Direct SQL UPDATE statements in Supabase Dashboard.

For each lender you've looked up:

```sql
UPDATE lenders SET fca_frn = '<FRN>', last_seen_at = NOW() 
WHERE name ILIKE '<lender name>' AND fca_frn IS NULL;
```

Example batch script:

```sql
-- Add 5 lenders at once
UPDATE lenders SET fca_frn = '346665', last_seen_at = NOW() WHERE name ILIKE 'Kensington' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '204503', last_seen_at = NOW() WHERE name ILIKE 'Aldermore Bank' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '535157', last_seen_at = NOW() WHERE name ILIKE 'Shawbrook Bank%' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '271612', last_seen_at = NOW() WHERE name ILIKE 'Together' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '308448', last_seen_at = NOW() WHERE name ILIKE 'Paragon' AND fca_frn IS NULL;
```

Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run

**Alternative — CSV bulk-load script:**

If you have a large batch (50+ lenders) already in CSV format, use the backfill script:

Create the CSV with two columns: `name,fcaFrn`

```csv
name,fcaFrn
Accord Mortgages,305936
Affirmative,667844
...
```

Then run:

```typescript
// packages/db/scripts/backfill-lender-frns.ts

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

    console.log(`[backfill] Updated: ${lender.name} → FRN ${row.fcaFrn}`);
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
```

Run it:

```bash
cd packages/db
npx tsx scripts/backfill-lender-frns.ts /path/to/lenders-with-frns.csv
```

### Step 4 — Verify the backfill

Check how many lenders now have FRNs:

```sql
SELECT
  COUNT(*) FILTER (WHERE fca_frn IS NOT NULL) AS with_frn,
  COUNT(*) FILTER (WHERE fca_frn IS NULL) AS without_frn,
  COUNT(*) AS total
FROM lenders
WHERE source IN ('SEED');
```

Expected: `with_frn` should be 80–120 (the major lenders plus active building societies). `without_frn` will be 60–100 (closed brands, niche lenders, non-FCA entities).

### Step 5 — Run the verification cron manually

Trigger the first verification run to confirm the FRNs are valid:

```bash
curl -s -X POST "https://your-app.onrender.com/api/cron/lenders-fca" \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

Expected response:

```json
{
  "ok": true,
  "feedStatus": "success",
  "lendersWithFrn": 95,
  "verified": 95,
  "stillActive": 94,
  "noLongerActive": 1,
  "notFound": 0,
  "markedInactive": 0
}
```

`notFound > 0` means one or more FRNs in the CSV were incorrect. Check the server logs for which ones.

---

## Incremental Backfill Strategy

You do not need to backfill all 188 lenders immediately. Focus on the top 50–80 lenders by usage:

1. **Phase 1 (immediate):** Major high-street lenders and top 10 building societies
   - Lloyds, Nationwide, Barclays, NatWest, Santander, HSBC, Halifax, Virgin Money, TSB, Metro Bank
   - Nationwide, Skipton, Yorkshire, Coventry, Leeds
   - ~15–20 FRNs, takes 30 minutes

2. **Phase 2 (next month):** Specialist lenders commonly used by advisers
   - Aldermore, Shawbrook, Together, Paragon, Kensington, Foundation Home Loans, LendInvest, Precise, Pepper Money
   - ~20–30 FRNs, takes 1 hour

3. **Phase 3 (background):** Building societies and niche lenders
   - Backfill as they appear in the Other-usage report

---

## Alternative — Supabase Dashboard Inline Edit

For small batches (5–10 lenders at a time):

1. Open Supabase Dashboard → Table Editor → `lenders`
2. Filter: `fca_frn IS NULL` AND `source = SEED`
3. Sort by name
4. For each row:
   - Search the lender on [register.fca.org.uk](https://register.fca.org.uk/s/)
   - Copy the FRN
   - Paste into the `fca_frn` cell, hit Enter
   - Set `last_seen_at = now()`

This is slower than CSV bulk-load but requires zero scripting.

---

## Summary

- Auto-backfill via FCA Search API is not feasible (API returns "Invalid Input")
- Manual lookup on register.fca.org.uk + CSV bulk-load is the correct approach
- Focus on top 50–80 lenders first (30–60 mins of manual lookup)
- The backfill script `packages/db/scripts/backfill-lender-frns.ts` is ready
- Once FRNs are loaded, the monthly verification cron provides full coverage
