# PRD-16 Phase 5 — Test Guide

## What Was Built

| Item | Location | Description |
| :---- | :---- | :---- |
| `lib/compliance/stale.ts` | New file | `checkAndSetRecommendationStale` + `clearRecommendationStale`. Transaction-safe. Writes SYSTEM CaseNote + logAuditEvent. |
| `updateCaseForOrg` extended | `lib/api/cases-data.ts` | Snapshots qualifying fields before update. Triggers stale when loanAmount / propertyValue / termYears / propertyId changes. |
| PATCH `/api/cases/:id` route | `app/api/cases/[id]/route.ts` | Passes `userId` to `updateCaseForOrg` so stale events are attributed. |
| `UpsertFactFindSchema` extended | `packages/types/src/index.ts` | `isAmend: z.boolean().optional()` added. |
| `upsertFactFindWithCompliance` extended | `lib/api/fact-find-data.ts` | `isAmend` bypasses completedAt guard. Writes `FACT_FIND_AMENDED` audit action. Triggers stale on qualifying section changes. |
| `createProductForCase` extended | `lib/api/products-data.ts` | Calls `clearRecommendationStale` inside the transaction when `isSelected=true`. |
| `updateProductForCase` extended | `lib/api/products-data.ts` | Same stale-clear on selection. |
| FINALISED protection verified | `lib/api/ai-data.ts` | No changes needed — `approveAiReportForOrg` and `regenerateSection` already guard FINALISED. `checkAndSetRecommendationStale` explicitly excludes APPROVED + FINALISED from `updateMany`. |

---

## Prerequisites

- Dev server running: `cd apps/web && pnpm dev` (port 3001)
- Valid `__session` cookie from a logged-in Clerk session
- A case that has at least one `ProductConsidered` with `isSelected: true`

```bash
SESSION="__session=PASTE_YOUR_COOKIE_HERE"
BASE="http://localhost:3001"

# Get a case with a selected product
CASE_ID=$(curl -s "$BASE/api/cases" -H "Cookie: $SESSION" | jq -r '.data[0].id')
echo "CASE_ID: $CASE_ID"
```

---

## Test Group 1 — Stale on loan amount change

### 1a. Select a product first (if none selected)

```bash
# Get products for the case
PRODUCTS=$(curl -s "$BASE/api/cases/$CASE_ID/products" -H "Cookie: $SESSION")
echo "$PRODUCTS" | jq '[.data[] | {id, lenderName, isSelected}]'

PRODUCT_ID=$(echo "$PRODUCTS" | jq -r '.data[0].id')

# Select it
curl -s -X PATCH "$BASE/api/cases/$CASE_ID/products/$PRODUCT_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isSelected": true}' | jq '{isSelected: .data.isSelected}'
```

**Expected:** `isSelected: true`

---

### 1b. Verify case is NOT stale before the change

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{recommendationStaleAt: .data.recommendationStaleAt}'
```

**Expected:** `recommendationStaleAt: null`

---

### 1c. Change loanAmount — triggers stale

```bash
# Get current loanAmount first
CURRENT=$(curl -s "$BASE/api/cases/$CASE_ID" -H "Cookie: $SESSION" | jq '.data.loanAmount')
echo "Current loanAmount: $CURRENT"

# Change it
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"loanAmount": 999999}' | jq '{success, loanAmount: .data.loanAmount}'
```

**Expected:** `success: true`, `loanAmount: 999999`

---

### 1d. Verify stale flag is now set

```bash
# Give the async stale check a moment to complete
sleep 1

curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{
    recommendationStaleAt: .data.recommendationStaleAt,
    staleNote: (.data.notes | map(select(.tag == "amend" and .source == "SYSTEM")) | last)
  }'
```

**Expected:**
```json
{
  "recommendationStaleAt": "2026-...",
  "staleNote": {
    "body": "Recommendation marked stale: Case financial details updated (loanAmount)",
    "tag": "amend",
    "source": "SYSTEM"
  }
}
```

---

### 1e. Verify non-FINALISED report dropped to DRAFT

If the case has a suitability report:

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const reports = await p.suitabilityReport.findMany({
    where: { caseId: 'PASTE_CASE_ID' },
    select: { id: true, status: true, updatedAt: true }
  });
  console.log(JSON.stringify(reports, null, 2));
  await p.\$disconnect();
})();
"
```

**Expected:** Any report that was `ADVISER_REVIEW` is now `DRAFT`. Any `FINALISED` report is unchanged.

---

### 1f. Verify stale is idempotent — second change does not double-write note

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"loanAmount": 888888}' | jq '{success}'

sleep 1

curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '[.data.notes[] | select(.tag == "amend" and .source == "SYSTEM")] | length'
```

**Expected:** Still only `1` stale note (idempotency — second trigger updates reason but does not create another note).

---

## Test Group 2 — Stale cleared on product re-selection

### 2a. Case must be stale first (use state from Group 1)

Confirm stale from Group 1d is still set.

### 2b. Re-select the same product — clears stale

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID/products/$PRODUCT_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isSelected": true}' | jq '{isSelected: .data.isSelected}'
```

**Expected:** `isSelected: true`

### 2c. Verify stale is cleared

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{
    recommendationStaleAt: .data.recommendationStaleAt,
    clearNote: (.data.notes | map(select(.tag == "amend" and .source == "SYSTEM")) | last)
  }'
```

**Expected:**
```json
{
  "recommendationStaleAt": null,
  "clearNote": {
    "body": "Recommendation stale flag cleared: product re-selected (...)",
    "tag": "amend",
    "source": "SYSTEM"
  }
}
```

---

## Test Group 3 — Fact-find amend path

### 3a. Complete the fact-find first (if not already)

```bash
curl -s -X PUT "$BASE/api/cases/$CASE_ID/fact-find" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"markComplete": true}' | jq '{success}'
```

### 3b. Try to edit a completed fact-find WITHOUT isAmend — should fail

```bash
curl -s -X PUT "$BASE/api/cases/$CASE_ID/fact-find" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"incomeDetails": {"grossSalary": 55000}}' | jq '{success, error}'
```

**Expected:** `success: false`, message containing "already complete" and "Use the Amend action".

---

### 3c. Edit a completed fact-find WITH isAmend — should succeed

```bash
curl -s -X PUT "$BASE/api/cases/$CASE_ID/fact-find" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isAmend": true, "incomeDetails": {"grossSalary": 55000}}' | jq '{success}'
```

**Expected:** `success: true`

---

### 3d. Verify FACT_FIND_AMENDED audit event

```bash
curl -s "$BASE/api/cases/$CASE_ID/timeline" \
  -H "Cookie: $SESSION" | jq '[.data[] | select(.action == "FACT_FIND_AMENDED")] | last'
```

**Expected:** An audit row with `action: "FACT_FIND_AMENDED"` and a diff showing the incomeDetails change.

---

### 3e. Verify stale triggered by amend of qualifying section

```bash
sleep 1

curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{
    recommendationStaleAt: .data.recommendationStaleAt,
    staleNote: (.data.notes | map(select(.tag == "amend" and .source == "SYSTEM" and (.body | contains("incomeDetails")))) | last)
  }'
```

**Expected:** `recommendationStaleAt` is set (non-null), stale note body contains "incomeDetails".

---

### 3f. Amend a NON-qualifying section — should NOT trigger stale

First clear stale by re-selecting a product (Group 2b). Then:

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID/products/$PRODUCT_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isSelected": true}' > /dev/null

sleep 1

# Now amend personalDetails — not a qualifying section
curl -s -X PUT "$BASE/api/cases/$CASE_ID/fact-find" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"isAmend": true, "personalDetails": {"title": "Dr"}}' | jq '{success}'

sleep 1

curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{recommendationStaleAt: .data.recommendationStaleAt}'
```

**Expected:** `recommendationStaleAt: null` — personal details change does NOT trigger stale.

---

## Test Group 4 — FINALISED report protection

### 4a. FINALISED report is not touched by stale check

```bash
# Check reports on the case — find a FINALISED one if it exists
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const reports = await p.suitabilityReport.findMany({
    where: { caseId: 'PASTE_CASE_ID', status: 'FINALISED' },
    select: { id: true, status: true }
  });
  console.log('FINALISED reports:', reports.length);
  await p.\$disconnect();
})();
"
```

Change loanAmount again (triggers stale), then re-check FINALISED report status:

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"loanAmount": 777777}' | jq '{success}'

sleep 1

# Verify FINALISED report is still FINALISED
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const r = await p.suitabilityReport.findFirst({
    where: { caseId: 'PASTE_CASE_ID', status: 'FINALISED' }
  });
  console.log('Still FINALISED:', r?.status);
  await p.\$disconnect();
})();
"
```

**Expected:** `Still FINALISED: FINALISED` — unchanged.

---

### 4b. Attempting to approve an already-FINALISED report returns 422

```bash
# This requires knowing a FINALISED report id — get from DB query above
REPORT_ID="paste-finalised-report-id"

curl -s -X POST "$BASE/api/ai/reports/$REPORT_ID/approve" \
  -H "Cookie: $SESSION" | jq '{success, code: .error.code, message: .error.message}'
```

**Expected:** `success: false`, `code: "BUSINESS_RULE_VIOLATION"`, message "Report is already finalised."

---

## Test Group 5 — Qualifying field list

The following PATCH fields trigger stale (when a product is selected):

| Field | Triggers stale? |
| :---- | :---- |
| `loanAmount` | ✓ |
| `propertyValue` | ✓ |
| `termYears` | ✓ |
| `propertyId` | ✓ |
| `rateType` | ✗ (account strip only) |
| `aipAt` | ✗ (date spine only) |
| `lenderId` | ✗ (lender select only) |
| `stage` | ✗ |

The following fact-find sections trigger stale on amend:

| Section | Triggers stale? |
| :---- | :---- |
| `incomeDetails` | ✓ |
| `expenditureDetails` | ✓ |
| `propertyDetails` | ✓ |
| `existingMortgages` | ✓ |
| `personalDetails` | ✗ |
| `employmentDetails` | ✗ |
| `clientPreferences` | ✗ |

---

## Phase 5 Acceptance Checklist

| # | Test | Pass condition |
| :- | :---- | :---- |
| 1 | Select product, then change loanAmount | `recommendationStaleAt` is set |
| 2 | Stale sets CaseNote source=SYSTEM tag=amend | Note body contains "loanAmount" |
| 3 | DRAFT/ADVISER_REVIEW reports reset to DRAFT | Status changed |
| 4 | FINALISED report unchanged after stale trigger | Status still FINALISED |
| 5 | Second stale trigger does not double-write note | Still 1 stale note |
| 6 | Re-select product → stale cleared | `recommendationStaleAt: null` |
| 7 | Clear writes CaseNote with "cleared" body | Note body contains "cleared" |
| 8 | Edit completed fact-find without isAmend → 403 | Error message contains "Amend action" |
| 9 | Edit with isAmend: true → succeeds | `success: true` |
| 10 | isAmend writes FACT_FIND_AMENDED audit event | Timeline shows correct action |
| 11 | isAmend on incomeDetails → stale triggered | `recommendationStaleAt` set |
| 12 | isAmend on personalDetails → stale NOT triggered | `recommendationStaleAt` null |
| 13 | Approve FINALISED report → 422 | BUSINESS_RULE_VIOLATION |
