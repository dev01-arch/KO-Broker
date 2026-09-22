# PRD-16 Phase 4 — Test Guide

## What Was Built

| Item | Location | Description |
| :---- | :---- | :---- |
| `properties-data.ts` | `apps/web/lib/api/properties-data.ts` | `createPropertyForClient`, `listPropertiesForClient`, `getPropertyById`, `serializeProperty`. Audit on create. |
| `GET /api/clients/:id/properties` | `apps/web/app/api/clients/[id]/properties/route.ts` | Returns all properties for a client. |
| `POST /api/clients/:id/properties` | same | Creates a new property on the client. |
| `GET /api/clients/:id` extended | `apps/web/app/api/clients/[id]/route.ts` | Now includes `properties[]` in response. |
| `POST /api/cases` extended | `apps/web/app/api/cases/route.ts` | Accepts `postcode` (auto-creates Property) and `propertyId` (links existing). |
| `CreateCaseSchema` extended | `packages/types/src/index.ts` | `postcode` and `propertyId` added as optional fields. |
| `assembleCasePreview` updated | `apps/web/lib/intelligence/case-preview.ts` | Reads `Case.property.postcode` first; falls back to FactFind JSON blobs. |
| `migrate-property-backfill.ts` | `packages/db/prisma/migrate-property-backfill.ts` | Best-effort backfill from `FactFind.propertyDetails` → `Property` rows. |

---

## Prerequisites

- Dev server running on port 3001 (`cd apps/web && pnpm dev`)
- Valid `__session` cookie from a logged-in Clerk session
- A valid `CLIENT_ID` and `CASE_ID` from your org

```bash
SESSION="__session=PASTE_YOUR_COOKIE_HERE"
BASE="http://localhost:3001"

CLIENT_ID=$(curl -s "$BASE/api/clients" -H "Cookie: $SESSION" | jq -r '.data[0].id')
CASE_ID=$(curl -s "$BASE/api/cases" -H "Cookie: $SESSION" | jq -r '.data[0].id')

echo "CLIENT_ID: $CLIENT_ID"
echo "CASE_ID:   $CASE_ID"
```

---

## Test Group 1 — Property CRUD (server required)

### 1a. POST a new property on a client

```bash
curl -s -X POST "$BASE/api/clients/$CLIENT_ID/properties" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "postcode": "SW1A 1AA",
    "type": "RESIDENTIAL",
    "currentValue": 450000,
    "tenure": "Freehold"
  }' | jq '{success, data: {id: .data.id, postcode: .data.postcode, type: .data.type, currentValue: .data.currentValue}}'
```

**Expected:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "postcode": "SW1A 1AA",
    "type": "RESIDENTIAL",
    "currentValue": 450000
  }
}
```

HTTP 201. `postcode` is uppercased automatically by the schema transform.

---

### 1b. POST a BTL property

```bash
curl -s -X POST "$BASE/api/clients/$CLIENT_ID/properties" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "postcode": "E1 6RF",
    "type": "BTL",
    "currentValue": 320000,
    "monthlyRent": 1800
  }' | jq '{postcode: .data.postcode, type: .data.type, monthlyRent: .data.monthlyRent}'
```

**Expected:** `type: "BTL"`, `monthlyRent: 1800`.

---

### 1c. POST property with missing postcode — should return 422

```bash
curl -s -X POST "$BASE/api/clients/$CLIENT_ID/properties" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"type": "RESIDENTIAL", "currentValue": 300000}' \
  | jq '{success, code: .error.code}'
```

**Expected:** `success: false`, `code: "VALIDATION_ERROR"`, HTTP 422.

---

### 1d. GET all properties for a client

```bash
curl -s "$BASE/api/clients/$CLIENT_ID/properties" \
  -H "Cookie: $SESSION" | jq '{count: (.data | length), postcodes: [.data[].postcode]}'
```

**Expected:** At least 2 rows (from 1a and 1b), postcodes match what was posted.

---

### 1e. Verify GET /api/clients/:id now includes properties[]

```bash
curl -s "$BASE/api/clients/$CLIENT_ID" \
  -H "Cookie: $SESSION" | jq '{id: .data.id, propertyCount: (.data.properties | length), firstProperty: .data.properties[0]}'
```

**Expected:** `propertyCount` > 0, `firstProperty` has `id`, `postcode`, `type`.

---

## Test Group 2 — Case create with postcode (server required)

### 2a. Create a case with postcode — auto-creates Property

```bash
curl -s -X POST "$BASE/api/cases" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"type\": \"PURCHASE\",
    \"propertyValue\": 400000,
    \"loanAmount\": 320000,
    \"termYears\": 25,
    \"postcode\": \"EC1A 1BB\"
  }" | jq '{success, id: .data.id, referenceNumber: .data.referenceNumber}'
```

**Expected:** HTTP 201, `success: true`. Save the case id.

```bash
NEW_CASE_ID=$(curl -s -X POST "$BASE/api/cases" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\": \"$CLIENT_ID\", \"type\": \"PURCHASE\", \"propertyValue\": 400000, \"loanAmount\": 320000, \"termYears\": 25, \"postcode\": \"EC1A 1BB\"}" \
  | jq -r '.data.id')
echo "New case: $NEW_CASE_ID"
```

---

### 2b. Verify the case has a propertyId and the Property exists

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const c = await p.case.findFirst({
    where: { id: 'PASTE_NEW_CASE_ID' },
    select: { referenceNumber: true, propertyId: true, property: { select: { postcode: true, type: true } } }
  });
  console.log(JSON.stringify(c, null, 2));
  await p.\$disconnect();
})();
"
```

**Expected:**
```json
{
  "referenceNumber": "KOF-...",
  "propertyId": "<property-id>",
  "property": { "postcode": "EC1A 1BB", "type": "RESIDENTIAL" }
}
```

---

### 2c. Create a case with an existing propertyId

Get a property id from 1a/1b:

```bash
PROPERTY_ID=$(curl -s "$BASE/api/clients/$CLIENT_ID/properties" \
  -H "Cookie: $SESSION" | jq -r '.data[0].id')

curl -s -X POST "$BASE/api/cases" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"type\": \"REMORTGAGE\",
    \"propertyValue\": 450000,
    \"loanAmount\": 200000,
    \"termYears\": 15,
    \"propertyId\": \"$PROPERTY_ID\"
  }" | jq '{success, id: .data.id}'
```

**Expected:** HTTP 201. Two cases now share the same property row.

---

### 2d. Create a case with invalid propertyId — should return 404

```bash
curl -s -X POST "$BASE/api/cases" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"type\": \"PURCHASE\",
    \"propertyId\": \"nonexistent-id-000\"
  }" | jq '{success, code: .error.code}'
```

**Expected:** `success: false`, `code: "NOT_FOUND"`.

---

## Test Group 3 — Intelligence preview reads Property.postcode

### 3a. Verify preview returns postcode from Property (not JSON blob)

Use the case created in 2a which has a linked Property with postcode `EC1A 1BB`:

```bash
curl -s "$BASE/api/intelligence/cases/$NEW_CASE_ID/preview" \
  -H "Cookie: $SESSION" | jq '.data.postcode'
```

**Expected:**
```json
{ "value": "EC1A 1BB", "present": true }
```

The postcode is read directly from `Case.property.postcode`, not from `FactFind.propertyDetails` JSON.

---

### 3b. Verify preview still works for cases without a linked Property (fallback)

Use an older case that has no `propertyId` but does have `FactFind.personalDetails.currentAddress.postcode`:

```bash
curl -s "$BASE/api/intelligence/cases/$CASE_ID/preview" \
  -H "Cookie: $SESSION" | jq '.data.postcode'
```

**Expected:** Either `{ "value": "...", "present": true }` (fallback from JSON) or `{ "value": null, "present": false }` (no postcode in JSON either). The route must not error.

---

## Test Group 4 — DB verification (no server required)

### 4a. Verify Property table has rows

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const total = await p.property.count();
  const residential = await p.property.count({ where: { type: 'RESIDENTIAL' } });
  const btl = await p.property.count({ where: { type: 'BTL' } });
  const withCase = await p.case.count({ where: { propertyId: { not: null } } });
  console.log('Total properties :', total);
  console.log('Residential      :', residential);
  console.log('BTL              :', btl);
  console.log('Cases with propertyId:', withCase);
  await p.\$disconnect();
})();
"
```

**Expected:** `total` > 0 after running the API tests. `withCase` > 0.

---

### 4b. Re-run the backfill to confirm idempotency

```bash
cd packages/db && npx tsx prisma/migrate-property-backfill.ts
```

**Expected (for demo/test data with no postcode in FactFind blobs):**
```
✅ Property backfill complete
   Inserted : 0 Property rows
   Skipped  : N (no propertyDetails or no postcode)
   Errors   : 0
```

No new inserts on re-run. For production data containing postcodes in `propertyDetails`, `Inserted` would be > 0 on first run and 0 on re-run.

---

## Phase 4 Acceptance Checklist

| # | Test | Pass condition |
| :- | :---- | :---- |
| 1 | POST property — RESIDENTIAL | HTTP 201, postcode uppercased |
| 2 | POST property — BTL with monthlyRent | `type: "BTL"`, `monthlyRent` present |
| 3 | POST property — missing postcode | HTTP 422, VALIDATION_ERROR |
| 4 | GET properties for client | Array, postcodes match |
| 5 | GET client detail includes properties[] | `data.properties` array present |
| 6 | POST case with postcode — auto-creates Property | Case has `propertyId`, Property has matching postcode |
| 7 | POST case with propertyId — links existing | Two cases share one Property row |
| 8 | POST case with invalid propertyId | HTTP 404 |
| 9 | Intel preview reads Property.postcode | `postcode.value` matches property postcode, `present: true` |
| 10 | Intel preview fallback works | No error on cases without linked Property |
| 11 | DB: properties table has rows | `total > 0` after API tests |
| 12 | Backfill is idempotent | `Inserted: 0` on second run |

---

## Design Notes

**Priority order for postcode in Intel preview:**
1. `Case.property.postcode` (first-class Property row — set when case is created with postcode, or linked later)
2. `FactFind.personalDetails.currentAddress.postcode` (JSON blob — legacy fallback)
3. `Client.address.postcode` (JSON blob — last fallback)
4. `null` — shows `present: false` in confirm box

**No Properties nav item:** Properties only appear on the client detail page (`data.properties[]`) and are pointed to from a case (`case.propertyId`). There is no `/api/properties` top-level route.

**Shared properties:** Multiple cases on the same home can share one `Property` row via `propertyId`. Creating a remortgage on the same address skips the postcode prompt if `propertyId` is already provided.
