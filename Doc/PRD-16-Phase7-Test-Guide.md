# PRD-16 Phase 7 — Test Guide

## What Was Built

| Item | Location | Description |
| :---- | :---- | :---- |
| `getDashboardBootstrap` extended | `apps/web/lib/api/dashboard-data.ts` | Adds `offersEnding14d` + `ratesEnding90d` counts to the bootstrap payload. Adviser-scoped. Active cases only. |
| `GET /api/cases` extended | `apps/web/app/api/cases/route.ts` | Accepts `offerEndingWithinDays` + `rateEndingWithinDays` query params as date-window filters. |
| `caseListSelect` extended | `apps/web/lib/api/cases-data.ts` | `offerExpiresAt` and `initialRateEndsAt` now included in list responses. |
| `GET/POST /api/cron/lenders-fca` | `apps/web/app/api/cron/lenders-fca/route.ts` | Cron route stub — returns 501 until FCA bulk-data source confirmed. CRON_SECRET auth. |
| `vercel.json` updated | `apps/web/vercel.json` | 4th cron entry: `0 6 1 * *` (06:00 UTC, 1st of each month). |

---

## Prerequisites

- Dev server running: `cd apps/web && pnpm dev` (port 3001)
- Valid `__session` cookie
- For radar tests: at least one case with `offerExpiresAt` or `initialRateEndsAt` set

```bash
SESSION="__session=PASTE_YOUR_COOKIE_HERE"
BASE="http://localhost:3001"

# Set a case's offerExpiresAt to 5 days from now for testing
CASE_ID=$(curl -s "$BASE/api/cases" -H "Cookie: $SESSION" | jq -r '.data[0].id')
FIVE_DAYS=$(date -d "+5 days" --iso-8601=seconds 2>/dev/null || date -v+5d +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{\"offerExpiresAt\": \"$FIVE_DAYS\"}" | jq '{success}'
```

---

## Test Group 1 — Dashboard radar counts (server required)

### 1a. Bootstrap includes radar counts

```bash
curl -s "$BASE/api/dashboard/bootstrap" \
  -H "Cookie: $SESSION" | jq '{offersEnding14d, ratesEnding90d}'
```

**Expected:**
```json
{
  "offersEnding14d": 1,
  "ratesEnding90d": 0
}
```

`offersEnding14d` is at least 1 (the case set up above). Values are integers, never null.

---

### 1b. Counts only include active cases (not COMPLETION or ARCHIVED)

Archive the test case and verify count drops:

```bash
# Archive the case
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d '{"stage": "ARCHIVED"}' | jq '{success}'

# Check count dropped
curl -s "$BASE/api/dashboard/bootstrap" \
  -H "Cookie: $SESSION" | jq '{offersEnding14d}'
```

**Expected:** `offersEnding14d` is now 0 or one fewer. Restore:

```bash
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d '{"stage": "OFFER"}' | jq '{success}'
```

---

### 1c. ratesEnding90d counts initialRateEndsAt within 90 days

```bash
SIXTY_DAYS=$(date -d "+60 days" --iso-8601=seconds 2>/dev/null || date -v+60d +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d "{\"initialRateEndsAt\": \"$SIXTY_DAYS\"}" | jq '{success}'

curl -s "$BASE/api/dashboard/bootstrap" \
  -H "Cookie: $SESSION" | jq '{ratesEnding90d}'
```

**Expected:** `ratesEnding90d` is at least 1.

---

### 1d. Case more than 90 days out does NOT count

```bash
TWO_YEARS=$(date -d "+730 days" --iso-8601=seconds 2>/dev/null || date -v+730d +"%Y-%m-%dT%H:%M:%SZ")

curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d "{\"initialRateEndsAt\": \"$TWO_YEARS\"}" | jq '{success}'

curl -s "$BASE/api/dashboard/bootstrap" \
  -H "Cookie: $SESSION" | jq '{ratesEnding90d}'
```

**Expected:** `ratesEnding90d` back to 0 (or unchanged from before the test).

---

## Test Group 2 — Cases list radar filters (server required)

### 2a. offerEndingWithinDays=14 returns only matching cases

```bash
# Set offerExpiresAt back to 5 days from now
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d "{\"offerExpiresAt\": \"$FIVE_DAYS\"}" > /dev/null

curl -s "$BASE/api/cases?offerEndingWithinDays=14" \
  -H "Cookie: $SESSION" | jq '{total: .meta.total, ids: [.data[].id]}'
```

**Expected:** Only cases whose `offerExpiresAt` falls between now and now+14 days.

---

### 2b. rateEndingWithinDays=90 returns only matching cases

```bash
# Set initialRateEndsAt to 60 days from now
curl -s -X PATCH "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d "{\"initialRateEndsAt\": \"$SIXTY_DAYS\"}" > /dev/null

curl -s "$BASE/api/cases?rateEndingWithinDays=90" \
  -H "Cookie: $SESSION" | jq '{total: .meta.total}'
```

**Expected:** At least 1 result.

---

### 2c. Date fields returned in case list responses

```bash
curl -s "$BASE/api/cases?offerEndingWithinDays=14" \
  -H "Cookie: $SESSION" | jq '.data[0] | {id, offerExpiresAt, initialRateEndsAt}'
```

**Expected:** Both fields present in each case row (may be null for cases without dates set).

---

### 2d. Filter can be combined with stage

```bash
curl -s "$BASE/api/cases?offerEndingWithinDays=14&stage=OFFER" \
  -H "Cookie: $SESSION" | jq '{total: .meta.total}'
```

**Expected:** Only OFFER-stage cases with offer expiry within 14 days.

---

### 2e. Filter with no matching cases returns empty array

```bash
curl -s "$BASE/api/cases?offerEndingWithinDays=1" \
  -H "Cookie: $SESSION" | jq '{total: .meta.total, data: (.data | length)}'
```

**Expected (if no cases expire tomorrow):** `total: 0`, `data: 0`.

---

## Test Group 3 — FCA cron stub (server required)

### 3a. GET without auth — returns 401 in production, runs in dev

In dev (no CRON_SECRET set):

```bash
curl -s "$BASE/api/cron/lenders-fca" | jq '{ok, status}'
```

**Expected in dev:**
```json
{ "ok": false, "status": "NOT_IMPLEMENTED" }
```

HTTP 501 — not 401 (dev mode skips auth if CRON_SECRET not set).

---

### 3b. POST with correct secret header

```bash
curl -s -X POST "$BASE/api/cron/lenders-fca" \
  -H "Authorization: Bearer $(grep CRON_SECRET apps/web/.env.local 2>/dev/null | cut -d= -f2 || echo 'test')" \
  | jq '{ok, status, message}'
```

**Expected:**
```json
{
  "ok": false,
  "status": "NOT_IMPLEMENTED",
  "message": "FCA lender sync is not yet implemented. ..."
}
```

HTTP 501. The message references the W0 spike decision document.

---

### 3c. Verify cron is registered in vercel.json

```bash
cat apps/web/vercel.json | jq '.crons[] | select(.path == "/api/cron/lenders-fca")'
```

**Expected:**
```json
{
  "path": "/api/cron/lenders-fca",
  "schedule": "0 6 1 * *"
}
```

Schedule: 06:00 UTC on the 1st of each month.

---

## Test Group 4 — DB spot check (no server required)

Verify the date fields added to `caseListSelect` are readable at the DB level:

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const withOffer = await p.case.count({ where: { offerExpiresAt: { not: null } } });
  const withRate = await p.case.count({ where: { initialRateEndsAt: { not: null } } });
  const now = new Date();
  const in14 = new Date(now); in14.setDate(in14.getDate() + 14);
  const in90 = new Date(now); in90.setDate(in90.getDate() + 90);
  const radar14 = await p.case.count({
    where: { offerExpiresAt: { gte: now, lte: in14 }, stage: { notIn: ['COMPLETION', 'ARCHIVED'] } }
  });
  const radar90 = await p.case.count({
    where: { initialRateEndsAt: { gte: now, lte: in90 }, stage: { notIn: ['COMPLETION', 'ARCHIVED'] } }
  });
  console.log('Cases with offerExpiresAt set  :', withOffer);
  console.log('Cases with initialRateEndsAt set:', withRate);
  console.log('Radar: offers ending 14d        :', radar14, '(matches bootstrap offersEnding14d)');
  console.log('Radar: rates ending 90d         :', radar90, '(matches bootstrap ratesEnding90d)');
  await p.\$disconnect();
})();
"
```

**Expected:** `radar14` and `radar90` match the values returned by `GET /api/dashboard/bootstrap`.

---

## Phase 7 Acceptance Checklist

| # | Test | Pass condition |
| :- | :---- | :---- |
| 1 | Bootstrap includes `offersEnding14d` | Integer, reflects case with offer expiry within 14 days |
| 2 | Bootstrap includes `ratesEnding90d` | Integer, reflects case with rate end within 90 days |
| 3 | ARCHIVED cases excluded from radar counts | Count drops when case is archived |
| 4 | `GET /api/cases?offerEndingWithinDays=14` filters correctly | Only cases in window returned |
| 5 | `GET /api/cases?rateEndingWithinDays=90` filters correctly | Only cases in window returned |
| 6 | Filters combinable with `stage=` | Correct intersection |
| 7 | `offerExpiresAt` + `initialRateEndsAt` in case list rows | Fields present in each row |
| 8 | FCA cron returns 501 NOT_IMPLEMENTED | `ok: false`, `status: "NOT_IMPLEMENTED"` |
| 9 | FCA cron in vercel.json | `schedule: "0 6 1 * *"` |
| 10 | DB radar counts match bootstrap counts | DB query and API agree |

---

## FCA Cron — Next Steps

The cron route is a registered, auth-protected stub. To implement it:

1. Complete the W0 FCA spike decision (record in `Doc/PRD-16-Backend-Engineering-Plan.md` Section 7).
2. If FCA bulk CSV is available: create `apps/web/lib/api/lenders-fca-ingest.ts` with `runFcaIngest()`.
3. If manual CSV fallback: add `POST /api/settings/lenders/import` route instead.
4. Replace the 501 stub in `lenders-fca/route.ts` with a call to `runFcaIngest()`.
5. The vercel.json schedule (`0 6 1 * *`) is already live — no further config needed.
