# PRD-16 Phase 2 — Test Guide

## What Was Built

| Item | Location | Description |
| :---- | :---- | :---- |
| `CreateProductConsideredSchema` extended | `packages/types/src/index.ts` | `lenderId`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary` added. `lenderName` now optional (backward compat). |
| `UpdateProductConsideredSchema` extended | `packages/types/src/index.ts` | Same new nullable fields for updates. |
| `SaveProductsSchema` extended | `packages/types/src/index.ts` | PRD-16 fields added to bulk sync schema. |
| `UpdateCaseSchema` consumed | `packages/types/src/index.ts` | Already extended in Phase 1; now fully persisted by `updateCaseForOrg`. |
| `resolveLenderName()` helper | `apps/web/lib/api/products-data.ts` | Looks up `Lender` by `lenderId`, derives display name, handles `Other` sentinel. |
| `createProductForCase` updated | `apps/web/lib/api/products-data.ts` | Resolves lender FK, writes `lenderId` + `lenderName` together. Syncs `Case.lenderId` on selection. |
| `updateProductForCase` updated | `apps/web/lib/api/products-data.ts` | Same for updates. Clears `Case.lenderId` on deselect. |
| `deleteProductForCase` updated | `apps/web/lib/api/products-data.ts` | Clears `Case.lenderId` when selected product deleted. |
| `serializeProductConsidered` extended | `apps/web/lib/api/products-data.ts` | Now exposes all PRD-16 fields in API response. |
| `updateCaseForOrg` updated | `apps/web/lib/api/cases-data.ts` | Explicit field-by-field update. Persists all 16 PRD-16 Case fields (date spine, account strip, lenderId, propertyId). ISO strings → Date via `toDate()` helper. |
| POST `/api/cases/:id/products` updated | `apps/web/app/api/cases/[id]/products/route.ts` | Handles new `VALIDATION_ERROR` return from data layer. |
| PATCH `/api/cases/:id/products/:id` updated | `apps/web/app/api/cases/[id]/products/[productId]/route.ts` | Same error handling. |
| `dev-store.ts` fixed | `apps/web/lib/api/dev-store.ts` | `lenderName` fallback to `lenderOtherName ?? 'Other'` for optional field. |

---

## Prerequisites

- Dev server running on port 3001 (`cd apps/web && pnpm dev`)
- Valid `__session` cookie from a logged-in Clerk session
- At least one existing case in the database (use the dashboard to create one, or use an existing caseId from Phase 1 testing)
- Phase 1 completed — the `lenders` table must be seeded (189 rows)

---

## Test Group 1 — Schema Validation (no server required)

These tests verify the Zod schemas behave correctly.

### 1a. CreateProductConsideredSchema — lenderId path (valid)

```bash
cd packages/db && npx tsx -e "
import { CreateProductConsideredSchema } from '../../packages/types/src/index.ts';

// Valid: lenderId provided, productName provided
const r1 = CreateProductConsideredSchema.safeParse({
  lenderId: 'some-cuid',
  productName: '2yr Fixed 4.5%',
  rate: 4.5,
  isSelected: false,
});
console.log('lenderId path valid:', r1.success); // expect true

// Valid: legacy lenderName only (backward compat)
const r2 = CreateProductConsideredSchema.safeParse({
  lenderName: 'NatWest',
  productName: '5yr Fixed 4.1%',
});
console.log('lenderName legacy valid:', r2.success); // expect true

// Invalid: neither lenderId nor lenderName
const r3 = CreateProductConsideredSchema.safeParse({
  productName: '2yr Fixed',
});
console.log('neither lender invalid:', !r3.success); // expect true (invalid)
if (!r3.success) console.log('error path:', r3.error.issues[0].path, r3.error.issues[0].message);
"
```

**Expected:**
```
lenderId path valid: true
lenderName legacy valid: true
neither lender invalid: true
error path: [ 'lenderId' ] Either lenderId or lenderName is required
```

---

### 1b. UpdateCaseDateSpineSchema — ISO datetime strings accepted

```bash
cd packages/db && npx tsx -e "
import { UpdateCaseSchema } from '../../packages/types/src/index.ts';

const r = UpdateCaseSchema.safeParse({
  aipAt: '2026-09-01T00:00:00.000Z',
  offerExpiresAt: '2026-12-01T00:00:00.000Z',
  rateType: 'Fixed',
  monthlyPayment: 1250.00,
  initialRateEndsAt: '2028-09-01T00:00:00.000Z',
});
console.log('date spine valid:', r.success); // expect true
if (r.success) console.log('parsed fields:', Object.keys(r.data));
"
```

**Expected:** `date spine valid: true` and the 5 field keys listed.

---

## Test Group 2 — HTTP API (server required)

For all tests below, set your session cookie:

```bash
SESSION="__session=PASTE_YOUR_COOKIE_HERE"
BASE="http://localhost:3001"
```

You also need a valid `CASE_ID`. Get one from:

```bash
curl -s "$BASE/api/cases" -H "Cookie: $SESSION" | jq '.data[0].id'
CASE_ID="paste-id-here"
```

And a valid `LENDER_ID` for NatWest:

```bash
NATWEST_ID=$(curl -s "$BASE/api/lenders?q=natwest" -H "Cookie: $SESSION" | jq -r '.data[0].id')
echo "NatWest lender ID: $NATWEST_ID"
```

---

### 2a. Create product with lenderId (new path)

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/products" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"lenderId\": \"$NATWEST_ID\",
    \"productName\": \"2yr Fixed 4.49%\",
    \"rate\": 4.49,
    \"fee\": 999,
    \"productType\": \"Fixed\",
    \"initialTermMonths\": 24,
    \"isSelected\": false
  }" | jq '{id, lenderName, lenderId, productName, productType, initialTermMonths}'
```

**Expected:**
```json
{
  "id": "...",
  "lenderName": "NatWest",
  "lenderId": "<natwest-id>",
  "productName": "2yr Fixed 4.49%",
  "productType": "Fixed",
  "initialTermMonths": 24
}
```

`lenderName` must be `"NatWest"` — derived from the Lender row, not typed manually.

---

### 2b. Create product with legacy lenderName (backward compat)

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/products" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "lenderName": "Santander",
    "productName": "5yr Fixed 3.99%",
    "rate": 3.99,
    "isSelected": false
  }' | jq '{id, lenderName, lenderId, productName}'
```

**Expected:**
```json
{
  "id": "...",
  "lenderName": "Santander",
  "lenderId": null,
  "productName": "5yr Fixed 3.99%"
}
```

`lenderId` is null — old callers still work without a FK.

---

### 2c. Create product with "Other" sentinel + lenderOtherName

```bash
OTHER_ID=$(curl -s "$BASE/api/lenders?q=Other" -H "Cookie: $SESSION" | jq -r '.data[-1].id')

curl -s -X POST "$BASE/api/cases/$CASE_ID/products" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"lenderId\": \"$OTHER_ID\",
    \"lenderOtherName\": \"Bespoke Finance Co\",
    \"productName\": \"Bridging Loan\",
    \"rate\": 0.85,
    \"isSelected\": false
  }" | jq '{lenderName, lenderId, lenderOtherName}'
```

**Expected:**
```json
{
  "lenderName": "Bespoke Finance Co",
  "lenderId": "<other-sentinel-id>",
  "lenderOtherName": "Bespoke Finance Co"
}
```

`lenderName` uses `lenderOtherName` as the display name when the sentinel is selected.

---

### 2d. Create product with neither lenderId nor lenderName — should return 422

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/products" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "5yr Fixed"
  }' | jq '{success, error}'
```

**Expected:**
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", ... }
}
```

HTTP 422, not 500.

---

### 2e. Select a product and verify Case.lenderId is synced

First, get the product IDs created above:

```bash
PRODUCTS=$(curl -s "$BASE/api/cases/$CASE_ID/products" -H "Cookie: $SESSION")
echo "$PRODUCTS" | jq '[.data[] | {id, lenderName, lenderId, isSelected}]'
PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.data[0].id')
```

Select the first product (the NatWest one):

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID/products/$PRODUCT_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isSelected": true}' | jq '{id, lenderName, lenderId, isSelected}'
```

**Expected:** `isSelected: true`, `lenderId` populated with NatWest's id.

Now check that `Case.lenderId` is also set:

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{id, selectedLender, lenderId}'
```

**Expected:**
```json
{
  "id": "...",
  "selectedLender": "NatWest",
  "lenderId": "<natwest-id>"
}
```

Both the legacy `selectedLender` string AND the new `lenderId` FK are set.

---

### 2f. Deselect the product — verify Case.lenderId is cleared

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID/products/$PRODUCT_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isSelected": false}' | jq '{isSelected}'

curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{selectedLender, lenderId}'
```

**Expected:** Both `selectedLender` and `lenderId` are `null` on the case.

---

### 2g. Update case with date spine fields

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "aipAt": "2026-09-15T00:00:00.000Z",
    "offerIssuedAt": "2026-10-01T00:00:00.000Z",
    "offerExpiresAt": "2027-01-01T00:00:00.000Z",
    "rateType": "Fixed",
    "monthlyPayment": 1450.00,
    "initialRateEndsAt": "2028-10-01T00:00:00.000Z"
  }' | jq '{success}'
```

**Expected:** `{ "success": true }` — HTTP 200.

Verify the fields were persisted by fetching the case:

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{aipAt, offerExpiresAt, rateType, monthlyPayment, initialRateEndsAt}'
```

**Expected:** All 5 fields populated with the values sent.

---

### 2h. Delete a product that was selected — verify Case.lenderId cleared

Select the product first (use product id from 2e):

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID/products/$PRODUCT_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isSelected": true}'

# Now delete it
curl -s -X DELETE "$BASE/api/cases/$CASE_ID/products/$PRODUCT_ID" \
  -H "Cookie: $SESSION" | jq .

# Check case is cleared
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{selectedLender, lenderId}'
```

**Expected:** After delete, both `selectedLender` and `lenderId` are `null`.

---

## Test Group 3 — Database verification (no server required)

Verify that the data written by the API tests is correct at the DB level.

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  // Check products have lenderId populated where a lender was selected by FK
  const withLenderId = await p.productConsidered.findMany({
    where: { lenderId: { not: null } },
    select: { lenderName: true, lenderId: true, productType: true, initialTermMonths: true },
    take: 5,
  });
  console.log('Products with lenderId:', JSON.stringify(withLenderId, null, 2));

  // Check cases have lenderId where a product is selected
  const casesWithLender = await p.case.findMany({
    where: { lenderId: { not: null } },
    select: { referenceNumber: true, selectedLender: true, lenderId: true },
    take: 5,
  });
  console.log('Cases with lenderId:', JSON.stringify(casesWithLender, null, 2));

  // Check cases with date spine populated
  const casesWithDates = await p.case.findMany({
    where: { offerExpiresAt: { not: null } },
    select: { referenceNumber: true, aipAt: true, offerExpiresAt: true, rateType: true, monthlyPayment: true },
    take: 5,
  });
  console.log('Cases with date spine:', JSON.stringify(casesWithDates, null, 2));

  await p.\$disconnect();
})();
"
```

**Expected:** Each section shows the records written by the API tests above.

---

## Phase 2 Acceptance Checklist

| # | Test | Pass condition |
| :- | :---- | :---- |
| 1 | Schema: `lenderId` path valid | `r1.success === true` |
| 2 | Schema: legacy `lenderName` valid | `r2.success === true` |
| 3 | Schema: neither lender rejected | `r3.success === false`, path `lenderId` |
| 4 | POST product with `lenderId` | `lenderName` derived from Lender row |
| 5 | POST product with legacy `lenderName` | `lenderId: null` in response |
| 6 | POST product with Other sentinel | `lenderName` = `lenderOtherName` value |
| 7 | POST product with no lender | HTTP 422 |
| 8 | Select product → `Case.lenderId` synced | Both `selectedLender` and `lenderId` set on case |
| 9 | Deselect product → `Case.lenderId` cleared | Both fields `null` |
| 10 | PATCH case with date spine | Fields persisted, HTTP 200 |
| 11 | Delete selected product → `Case.lenderId` cleared | Both fields `null` |

---

## Backward Compatibility Summary

Existing API callers that send `lenderName` as a plain string continue to work without changes:

- `lenderName` without `lenderId` → accepted, `lenderId` stays null
- `lenderId` provided → `lenderName` derived from the Lender row automatically
- Both provided → `lenderId` takes priority, `lenderName` from Lender row

The `selectedLender` string field on Case is still written on every product selection — no existing frontend code breaks.
