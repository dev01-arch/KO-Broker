# PRD-16 Phase 1 — Test Guide

## What Was Built

| Item | Location | Description |
| :---- | :---- | :---- |
| 5 new Prisma enums | `packages/db/prisma/schema.prisma` | `LenderStatus`, `LenderSource`, `PropertyType`, `CaseNoteSource`, `InfoRequestStatus` |
| `Lender` model | schema.prisma | Global lender directory. 189 rows seeded. |
| `Property` model | schema.prisma | Client-owned property. Org-scoped. |
| `CaseNote` model | schema.prisma | Append-only notes thread on a case. |
| `ClientInfoRequest` model | schema.prisma | Tracks outstanding document requests. |
| New nullable columns on `Case` | schema.prisma | Date spine (7), account strip (5), lender/property FKs, stale fields. |
| New nullable columns on `ProductConsidered` | schema.prisma | `lenderId`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary` |
| Lender seed script | `packages/db/prisma/seed-lenders.ts` | 188 named lenders + Other sentinel. 4 LEGACY brands. |
| PRD-16 Zod types | `packages/types/src/index.ts` | All new schemas for lender, property, notes, info-requests |
| `UpdateCaseSchema` extended | `packages/types/src/index.ts` | Date spine + lender/property FK fields added |
| `lenders-data.ts` | `apps/web/lib/api/lenders-data.ts` | `searchLenders()`, `getLenderById()` |
| `GET /api/lenders` route | `apps/web/app/api/lenders/route.ts` | Searchable lender directory endpoint |

---

## Prerequisites

Before running any tests, make sure:

1. The dev server is **not** required for DB-level tests (they hit Supabase directly).
2. The dev server **is** required for HTTP API tests.
3. You have a valid session cookie — the `/api/lenders` endpoint requires a logged-in Clerk session.

---

## Test Group 1 — Database Schema (no server required)

These tests run directly against the live Supabase database from the `packages/db` directory. They verify the schema was pushed correctly and the seed ran.

### 1a. Verify tables exist and row counts

```bash
cd packages/db

npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const lenders        = await p.lender.count();
  const legacy         = await p.lender.count({ where: { status: 'LEGACY' } });
  const other          = await p.lender.count({ where: { source: 'OTHER' } });
  const properties     = await p.property.count();
  const caseNotes      = await p.caseNote.count();
  const infoRequests   = await p.clientInfoRequest.count();
  console.log('lenders:', lenders, '(expect 189)');
  console.log('legacy:', legacy, '(expect 4)');
  console.log('other sentinel:', other, '(expect 1)');
  console.log('properties:', properties, '(expect 0 — empty table)');
  console.log('caseNotes:', caseNotes, '(expect 0 — empty table)');
  console.log('infoRequests:', infoRequests, '(expect 0 — empty table)');
  await p.\$disconnect();
})();
"
```

**Expected output:**
```
lenders: 189 (expect 189)
legacy: 4 (expect 4)
other sentinel: 1 (expect 1)
properties: 0 — empty table
caseNotes: 0 — empty table
infoRequests: 0 — empty table
```

---

### 1b. Verify LEGACY brands

```bash
cd packages/db

npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const rows = await p.lender.findMany({
    where: { status: 'LEGACY' },
    select: { name: true, status: true },
    orderBy: { name: 'asc' }
  });
  console.log(JSON.stringify(rows, null, 2));
  await p.\$disconnect();
})();
"
```

**Expected output:**
```json
[
  { "name": "Bradford & Bingley", "status": "LEGACY" },
  { "name": "Intelligent Finance", "status": "LEGACY" },
  { "name": "Mortgage Express", "status": "LEGACY" },
  { "name": "NRAM", "status": "LEGACY" }
]
```

---

### 1c. Verify Other sentinel

```bash
cd packages/db

npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const row = await p.lender.findFirst({ where: { source: 'OTHER' } });
  console.log(JSON.stringify(row, null, 2));
  await p.\$disconnect();
})();
"
```

**Expected output:**
```json
{
  "name": "Other",
  "normalizedName": "other",
  "source": "OTHER",
  "status": "ACTIVE"
}
```

---

### 1d. Verify search by name

```bash
cd packages/db

npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  // Clydesdale — key acceptance criterion from PRD-16
  const clydes = await p.lender.findMany({
    where: { name: { contains: 'clydes', mode: 'insensitive' } }
  });
  console.log('Clydesdale search:', JSON.stringify(clydes.map(l => l.name)));

  // NatWest — common lender
  const natwest = await p.lender.findMany({
    where: { name: { contains: 'natwest', mode: 'insensitive' } }
  });
  console.log('NatWest search:', JSON.stringify(natwest.map(l => l.name)));

  // Santander
  const santander = await p.lender.findMany({
    where: { name: { contains: 'santander', mode: 'insensitive' } }
  });
  console.log('Santander search:', JSON.stringify(santander.map(l => l.name)));

  await p.\$disconnect();
})();
"
```

**Expected output:**
```
Clydesdale search: ["Clydesdale Bank PLC"]
NatWest search: ["NatWest","Natwest International"]
Santander search: ["Santander"]
```

---

### 1e. Verify new Case columns exist

```bash
cd packages/db

npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  // Fetch one case and check new fields are present (null is fine — they're new)
  const c = await p.case.findFirst({
    select: {
      id: true,
      propertyId: true,
      lenderId: true,
      aipAt: true,
      offerExpiresAt: true,
      initialRateEndsAt: true,
      rateType: true,
      monthlyPayment: true,
      recommendationStaleAt: true,
    }
  });
  if (!c) { console.log('No cases in DB — column check skipped (OK)'); }
  else { console.log('Case columns present:', JSON.stringify(c, null, 2)); }
  await p.\$disconnect();
})();
"
```

**Expected output:** Either `No cases in DB — column check skipped (OK)` or a JSON object where all the listed keys are present (values will be `null`). If you get a Prisma error like `Unknown column`, the schema push did not apply.

---

### 1f. Verify new ProductConsidered columns exist

```bash
cd packages/db

npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const prod = await p.productConsidered.findFirst({
    select: {
      id: true,
      lenderId: true,
      lenderOtherName: true,
      productType: true,
      initialTermMonths: true,
      ercSummary: true,
    }
  });
  if (!prod) { console.log('No products in DB — column check skipped (OK)'); }
  else { console.log('ProductConsidered columns present:', JSON.stringify(prod, null, 2)); }
  await p.\$disconnect();
})();
"
```

**Expected:** Keys present, values null (or actual data if records exist).

---

### 1g. Re-run the seed to confirm idempotency

```bash
cd packages/db

npx tsx prisma/seed-lenders.ts
```

**Expected output:**
```
🌱 Seeding lenders (PRD-16 W0)...
  ✓ "Other" sentinel row already exists
✅ Lender seed complete
   Inserted : 0
   Skipped  : 188 (already existed)
   Legacy   : 0 (Bradford & Bingley, NRAM, Mortgage Express, Intelligent Finance)
   Total    : 189 lenders in DB
```

All 188 skipped, 0 inserted — confirms no duplicates on re-run.

---

## Test Group 2 — TypeScript Compilation

No server required. Run from the monorepo root.

### 2a. Types package

```bash
pnpm --filter @ko/types typecheck
```

**Expected:** No output, exit 0.

### 2b. DB package

```bash
pnpm --filter @ko/db typecheck
```

**Expected:** No output, exit 0.

### 2c. Web app

```bash
# Run from repo root — writes result to /tmp/tsc2-errors.txt
node -e "
const {spawnSync} = require('child_process');
const fs = require('fs');
const r = spawnSync('node', ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false'], {
  cwd: '$(pwd)/apps/web', encoding: 'utf8', maxBuffer: 20*1024*1024
});
const out = (r.stdout||'')+(r.stderr||'');
fs.writeFileSync('/tmp/tsc2-errors.txt', out || '(no output — clean)');
console.log('exit:', r.status);
if (out) console.log(out);
"
```

**Expected:** `exit: 0` and no error lines. If you see errors only in `lib/clients/import-parse.ts` those are from the xlsx/papaparse packages — install them with `pnpm add papaparse xlsx @types/papaparse` inside `apps/web` to clear them.

---

## Test Group 3 — HTTP API (server required)

The `/api/lenders` endpoint requires a running dev server and a valid Clerk session cookie.

### 3a. Start the dev server

```bash
cd apps/web
pnpm dev
```

The server starts on **port 3001** (configured in `package.json`). Wait until you see:
```
✓ Ready in Xs
```

### 3b. Get a session cookie

The endpoint uses Clerk auth. You need to log in through the browser first, then copy the `__session` cookie from DevTools.

1. Open `http://localhost:3001` in your browser
2. Log in with your Clerk credentials
3. Open DevTools → Application → Cookies → `localhost`
4. Copy the value of the `__session` cookie

### 3c. Test lender search — Clydesdale (key acceptance criterion)

```bash
curl -s "http://localhost:3001/api/lenders?q=clydes" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE_HERE" \
  | jq .
```

**Expected response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Clydesdale Bank PLC",
      "normalizedName": "clydesdale bank plc",
      "status": "ACTIVE",
      "source": "SEED"
    },
    {
      "id": "...",
      "name": "Other",
      "normalizedName": "other",
      "status": "ACTIVE",
      "source": "OTHER"
    }
  ]
}
```

`Other` is always appended last. `Clydesdale Bank PLC` must be the first result.

---

### 3d. Test lender search — NatWest

```bash
curl -s "http://localhost:3001/api/lenders?q=natwest" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE_HERE" \
  | jq .
```

**Expected:** Two results — `NatWest` and `Natwest International`, plus `Other` last.

---

### 3e. Test no query — returns first 20 lenders

```bash
curl -s "http://localhost:3001/api/lenders" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE_HERE" \
  | jq '.data | length, .data[-1].name'
```

**Expected:**
```
21
"Other"
```

21 = 20 named lenders + Other sentinel last.

---

### 3f. Test INACTIVE lenders are excluded

There are no INACTIVE lenders in the seed, so this test confirms the filter is wired. Add one temporarily if you want to verify exclusion:

```bash
cd packages/db

# Mark NatWest as INACTIVE temporarily
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  await p.lender.update({ where: { name: 'NatWest' }, data: { status: 'INACTIVE' } });
  console.log('NatWest set INACTIVE');
  await p.\$disconnect();
})();
"
```

Then search:

```bash
curl -s "http://localhost:3001/api/lenders?q=natwest" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE_HERE" \
  | jq '.data[].name'
```

**Expected:** Only `Natwest International` (NatWest is excluded). `Other` still appears last.

Restore:

```bash
cd packages/db

npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  await p.lender.update({ where: { name: 'NatWest' }, data: { status: 'ACTIVE' } });
  console.log('NatWest restored to ACTIVE');
  await p.\$disconnect();
})();
"
```

---

### 3g. Test LEGACY lenders are included

```bash
curl -s "http://localhost:3001/api/lenders?q=bradford" \
  -H "Cookie: __session=YOUR_SESSION_COOKIE_HERE" \
  | jq '.data[] | {name, status}'
```

**Expected:**
```json
{ "name": "Bradford & Bingley", "status": "LEGACY" }
{ "name": "Other", "status": "ACTIVE" }
```

LEGACY rows appear in search results — advisers can still record remortgage products against closed brands.

---

### 3h. Test unauthenticated request is rejected

```bash
curl -s "http://localhost:3001/api/lenders?q=clydes" | jq .
```

**Expected:** A 401 or redirect response (no `success: true` in body). The endpoint must not return data without a valid session.

---

## Test Group 4 — Lint

```bash
cd apps/web
pnpm exec eslint app/api/lenders/route.ts lib/api/lenders-data.ts
```

**Expected:** No output, exit 0.

---

## Phase 1 Acceptance Checklist

Run through these in order. All must pass before Phase 2 begins.

| # | Test | Command group | Pass condition |
| :- | :---- | :---- | :---- |
| 1 | 189 lenders in DB | Group 1a | `lenders: 189` |
| 2 | 4 LEGACY brands | Group 1b | Bradford & Bingley, Intelligent Finance, Mortgage Express, NRAM |
| 3 | Other sentinel exists | Group 1c | `source: "OTHER"`, `status: "ACTIVE"` |
| 4 | Clydesdale found by search | Group 1d | `["Clydesdale Bank PLC"]` |
| 5 | New Case columns present | Group 1e | No Prisma error, keys present |
| 6 | New ProductConsidered columns present | Group 1f | No Prisma error, keys present |
| 7 | Seed is idempotent | Group 1g | `Inserted: 0, Skipped: 188` |
| 8 | `tsc --noEmit` clean | Group 2c | `exit: 0` |
| 9 | `GET /api/lenders?q=clydes` | Group 3c | `data[0].name === "Clydesdale Bank PLC"` |
| 10 | Other always last | Group 3c / 3d | `data[-1].name === "Other"` |
| 11 | INACTIVE excluded | Group 3f | NatWest not in results when INACTIVE |
| 12 | LEGACY included | Group 3g | Bradford & Bingley appears with `status: "LEGACY"` |
| 13 | Unauthenticated rejected | Group 3h | No lender data returned without session |

---

## Troubleshooting

**"Cannot find module" error in tsx commands**

Make sure you are running from `packages/db` so `@prisma/client` resolves correctly. The `DIRECT_URL` env var must be set (it is in `packages/db/.env`).

**"P1001: Can't reach database server" error**

The Supabase connection is timing out. Check your network, or try swapping `DIRECT_URL` for `DATABASE_URL` in the test commands.

**`GET /api/lenders` returns 401 / redirect**

Your `__session` cookie has expired. Log out and back in through the browser, then copy the cookie again.

**`GET /api/lenders` returns 500**

Check the dev server terminal for the Prisma error. Most likely the `lenders` table doesn't exist — re-run `pnpm --filter @ko/db push` from the repo root.

**Seed shows `Inserted: 0, Skipped: 0`**

The `DIRECT_URL` in `packages/db/.env` is pointing to a different database. Verify the Supabase project URL matches the one used during the `db push`.
