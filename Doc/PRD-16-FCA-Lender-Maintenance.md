# FCA Lender Directory — Operational Maintenance Guide

| Field | Detail |
| :---- | :---- |
| **Audience** | Head of D&E, Backend Engineer, Technical PM |
| **Updated** | September 2026 |
| **Relates to** | PRD-16 W6, `lib/api/lenders-fca-ingest.ts` |

---

## Overview

The lender directory ships with 189 names seeded from Appendix A of PRD-16.
Keeping it current is a two-track process:

| Track | Mechanism | Owner | Frequency |
| :---- | :---- | :---- | :---- |
| **Verification** | Automated cron checks known FRNs against FCA register | System | Monthly |
| **Discovery** | D&E reviews Other-usage report and adds new names manually | D&E | Monthly (alongside cron report) |

Neither track requires developer intervention in normal operation. The cron runs
itself. The discovery review takes ~10 minutes once a month.

---

## Track 1 — Automated Verification

### What it does

On the 1st of every month at 06:00 UTC, the cron calls
`POST /api/cron/lenders-fca`. The `runFcaIngest()` function:

1. Fetches every `Lender` row where `fcaFrn IS NOT NULL` and `source IN (SEED, FCA)`
2. For each, calls `GET /Firm/{FRN}` on the FCA FS Register API
3. Updates `lastSeenAt = now` on every lender that responds
4. Logs lenders that no longer appear as authorised
5. After all verifications: marks any FCA-sourced lender whose `lastSeenAt` is
   older than 32 days as `INACTIVE` — provided it has no active
   `ProductConsidered` or `Case` references (those are protected)
6. Updates `DataFeedStatus { feedId: 'FCA_LENDERS' }`

### What it does NOT do

It does not search for new lenders. Discovery is handled manually — see Track 2.

### Prerequisites

Two environment variables must be set on the web service:

```
FCA_API_EMAIL = the email address used to register at register.fca.org.uk/developer/s/
FCA_API_KEY   = the API key from the FCA Developer Portal
```

If either is missing the cron returns HTTP 503 and `DataFeedStatus` records the
error. Lender search continues to work from the existing seed — the cron is not
on the critical path for the application.

**Register for a free key:** [register.fca.org.uk/developer/s/](https://register.fca.org.uk/developer/s/)

### Checking the last run

**Via the platform API:**

```bash
curl -s "$APP_URL/api/intelligence/overview" \
  -H "Cookie: __session=$SESSION" | jq '.data.feedStatuses[] | select(.feedId == "FCA_LENDERS")'
```

**Directly in the database:**

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const s = await p.dataFeedStatus.findFirst({ where: { feedId: 'FCA_LENDERS' } });
  console.log('FCA_LENDERS feed status:');
  console.log('  Last attempt:', s?.lastAttemptAt?.toISOString() ?? 'never');
  console.log('  Last success:', s?.lastSuccessAt?.toISOString() ?? 'never');
  console.log('  Last error  :', s?.lastError ?? 'none');
  await p.\$disconnect();
})();
"
```

### Triggering manually

Run an out-of-schedule verification — for example after initially setting the
FCA credentials, or after a failed run:

```bash
APP_URL="https://your-app.onrender.com"   # or Vercel URL
SECRET="your-cron-secret"

curl -s -X POST "$APP_URL/api/cron/lenders-fca" \
  -H "Authorization: Bearer $SECRET" | jq .
```

**Healthy response:**

```json
{
  "ok": true,
  "feedStatus": "success",
  "lendersWithFrn": 12,
  "verified": 12,
  "stillActive": 11,
  "noLongerActive": 1,
  "notFound": 0,
  "markedInactive": 0
}
```

`noLongerActive > 0` means one or more known lenders have changed status on the
FCA register. Check which ones in the server logs, then review Track 2 to decide
whether to manually mark them INACTIVE.

`notFound > 0` means one or more FRNs returned a 404 from the FCA API. Check
the server logs — the lender name is printed. This usually means a firm has been
deauthorised and its register entry removed. If it has no active cases or
products it will be marked INACTIVE automatically on the next run (32-day grace).

### Reading the verification log

When the cron runs, the server logs contain one line per lender checked:

```
[fca-verify] Starting FCA lender verification...
[fca-verify] 12 lender(s) with known FRN to verify
[fca-verify] No longer active: Masthaven (cancelled - regulatory decision)
[fca-verify] Not found in register: Example Bank (FRN: 999999)
[fca-verify] Marked INACTIVE: Example Bank (FRN: 999999)
[fca-verify] Complete: { feedStatus: 'success', lendersWithFrn: 12, ... }
```

On Vercel: Dashboard → Project → Logs → filter by `/api/cron/lenders-fca`.
On Render: Dashboard → Web Service → Logs.

---

## Track 2 — Manual Discovery

### The principle

When an adviser selects "Other" and types a lender name, that entry is recorded
in `ProductConsidered.lenderOtherName`. This is the discovery signal. A name
that appears once might be a one-off. A name that appears three or more times
across different cases is a lender that should be in the directory.

D&E checks this report monthly alongside the cron run, spends ~10 minutes
reviewing new entries, and adds confirmed lenders via the admin endpoint.

### Step 1 — Pull the Other-usage report

**API:**

```bash
curl -s "$APP_URL/api/admin/lenders/other-usage" \
  -H "Cookie: __session=$ADMIN_SESSION" | jq .
```

**Response shape:**

```json
{
  "success": true,
  "data": [
    {
      "name": "Perenna",
      "normalizedName": "perenna",
      "count": 5,
      "alreadyInDirectory": false,
      "firstSeen": "2026-07-14T10:22:00.000Z",
      "lastSeen": "2026-09-02T14:05:00.000Z",
      "caseRefs": ["KOF-2026-0041", "KOF-2026-0058", "KOF-2026-0073"]
    },
    {
      "name": "Tandem Bank",
      "normalizedName": "tandem bank",
      "count": 2,
      "alreadyInDirectory": true,
      "firstSeen": "2026-08-20T09:10:00.000Z",
      "lastSeen": "2026-08-28T11:30:00.000Z",
      "caseRefs": ["KOF-2026-0062", "KOF-2026-0069"]
    }
  ],
  "meta": { "total": 2, "pendingReview": 1 }
}
```

`alreadyInDirectory: false` means the name is not yet in the lender table —
these are the ones that need review.

`alreadyInDirectory: true` means the name was added since the products were
created. No action needed — advisers will see it in the dropdown going forward.

**Focus on:** `alreadyInDirectory: false` AND `count >= 3`

Names with `count < 3` may be one-off typos or niche lenders used rarely.
Use judgment — if a name looks like a real authorised lender, still check it.

### Step 2 — Confirm on the FCA register

For each name pending review:

1. Go to [register.fca.org.uk](https://register.fca.org.uk/s/)
2. Search for the firm name
3. Confirm two things:
   - The firm is `Authorised` (not Cancelled, Registered-only, or Appointed Representative)
   - The firm has the permission **"Entering into a regulated mortgage contract"** listed under Permissions
4. Note the **FCA Firm Reference Number (FRN)** — the 6-7 digit number shown on the firm page

If the firm is not found or does not have the mortgage permission, do not add it.
The adviser will need to continue using Other for that lender.

### Step 3 — Add the confirmed lender

**API:**

```bash
curl -s -X POST "$APP_URL/api/admin/lenders" \
  -H "Cookie: __session=$ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Perenna",
    "fcaFrn": "956868",
    "status": "ACTIVE"
  }' | jq .
```

**Request fields:**

| Field | Type | Required | Notes |
| :---- | :---- | :---- | :---- |
| `name` | string | Yes | Use the exact name from the FCA register |
| `fcaFrn` | string | Recommended | 6-7 digit FRN from the register firm page |
| `status` | `ACTIVE` \| `LEGACY` | No | Defaults to `ACTIVE`. Use `LEGACY` for closed brands still needed for remortgage files. |

**Success response (HTTP 201):**

```json
{
  "success": true,
  "data": {
    "id": "cm...",
    "name": "Perenna",
    "normalizedName": "perenna",
    "fcaFrn": "956868",
    "status": "ACTIVE",
    "source": "SEED",
    "createdAt": "2026-10-01T06:15:00.000Z"
  }
}
```

The lender is immediately available in `GET /api/lenders` search — advisers will
see it in their dropdown on the next keystroke. No deployment required.

**Conflict errors:**

| Error | Meaning | Action |
| :---- | :---- | :---- |
| `"A lender with this name already exists"` + `status: INACTIVE` | The lender was previously deactivated | Reactivate it instead: `PATCH /api/admin/lenders/:id` (future endpoint) or set `status = ACTIVE` directly in DB |
| `"FRN ... is already assigned to ..."` | Same FRN exists under a different name | The existing entry might have an old name — review and update the existing row |

### Step 4 — Backfill FRNs for existing seed lenders

Many of the 189 seeded lenders have `fcaFrn = null` because the seed was loaded
from a name list without FRNs. Backfilling FRNs improves the verification cron's
coverage and accuracy.

**Quick start:** Use the ready-to-run SQL script in `Doc/FCA-FRN-Backfill-Top-20-SQL.md`.
It backfills the top 20 UK lenders in one go (10 high-street banks, 4 building
societies, 6 specialist lenders). Takes ~2 seconds to run in Supabase Dashboard → SQL Editor.

**For additional lenders:**

1. Search the FCA register by name at [register.fca.org.uk](https://register.fca.org.uk/s/)
2. Confirm the firm has the "Entering into a regulated mortgage contract" permission
3. Note the FRN (6-7 digit number)
4. Run in Supabase SQL Editor:

```sql
UPDATE lenders SET fca_frn = '<FRN>', last_seen_at = NOW() 
WHERE name ILIKE '<lender name>' AND fca_frn IS NULL;
```

**Batch approach:** For 10+ lenders at once, create a SQL script with multiple UPDATE statements (see `Doc/FCA-FRN-Backfill-Top-20-SQL.md` as a template).

---

## Admin Endpoints Reference

All admin endpoints require an `ADMIN` role Clerk session. They are not
accessible to ADVISER or COMPLIANCE roles.

### `GET /api/admin/lenders`

Lists every lender including INACTIVE, with FRN and status metadata.

```bash
curl -s "$APP_URL/api/admin/lenders" \
  -H "Cookie: __session=$ADMIN_SESSION" | jq '.meta'
```

```json
{
  "total": 190,
  "active": 185,
  "legacy": 4,
  "inactive": 1,
  "withFrn": 14
}
```

### `GET /api/admin/lenders/other-usage`

Ranked list of Other-field entries from products across all cases in the org.
See Step 1 above for full response shape.

### `POST /api/admin/lenders`

Add a new lender. See Step 3 above for full request/response.

---

## Monthly Checklist for D&E

Run through this on or just after the 1st of each month:

```
[ ] 1. Check DataFeedStatus for FCA_LENDERS — was last_success_at updated?
[ ] 2. If last run failed: check logs, resolve error, trigger manual run
[ ] 3. Check noLongerActive count in the run response — any lenders to review?
[ ] 4. Pull GET /api/admin/lenders/other-usage
[ ] 5. For each entry with alreadyInDirectory=false and count >= 3:
        [ ] Search FCA register, confirm authorised + mortgage permission
        [ ] Note FRN
        [ ] POST /api/admin/lenders to add it
[ ] 6. For entries with count 1-2: note and revisit next month
[ ] 7. (Background) Backfill 5-10 FRNs for existing seed lenders with fcaFrn=null
```

Total time: ~10 minutes on a normal month. Longer only if several new lenders
need to be verified or there is an error to investigate.

---

## Troubleshooting

### Cron returns 503

`FCA_API_EMAIL` or `FCA_API_KEY` is not set on the deployment. Add both env vars
and restart the service. Register for a free key at
[register.fca.org.uk/developer/s/](https://register.fca.org.uk/developer/s/).

### Cron returns 401

`CRON_SECRET` mismatch. The `Authorization: Bearer` header sent by the scheduler
does not match the `CRON_SECRET` env var on the web service. Ensure both match.

### Cron returns 500 with `FCA API 429`

The FCA rate limit was hit. This should not happen with the 1200ms delay in
normal operation. If it does, increase `REQUEST_DELAY_MS` in `lenders-fca-ingest.ts`
to 1500ms and redeploy.

### POST /api/admin/lenders returns 409 "already exists" but lender is INACTIVE

The lender was previously deactivated. It cannot be re-added as a duplicate.
Reactivate the existing row:

```sql
-- Run in Supabase Dashboard → SQL Editor
UPDATE lenders
SET status = 'ACTIVE', last_seen_at = now()
WHERE normalized_name = 'perenna';
```

### A lender is showing as INACTIVE but advisers still need it

It was marked INACTIVE because `lastSeenAt` aged out, but it has no ProductConsidered
or Case references yet. Reactivate it and add the FRN so future verification
runs keep it current:

```sql
UPDATE lenders
SET status = 'ACTIVE', fca_frn = '956868', last_seen_at = now()
WHERE name = 'Perenna';
```

### A lender was added via Other + a typo in the name

The existing `ProductConsidered` rows will keep the typo'd name in `lenderName`
(that column is never modified once written — it's the historical record). The
new correctly-spelled entry will appear in the dropdown going forward. Advisers
on those specific cases can update the product's lender via the product edit flow.

---

## Data Model Reference

| Column | Table | Notes |
| :---- | :---- | :---- |
| `fca_frn` | `lenders` | FCA Firm Reference Number. Null for most seeded lenders initially. |
| `last_seen_at` | `lenders` | Updated each time the cron confirms this FRN is still authorised. |
| `status` | `lenders` | `ACTIVE` \| `INACTIVE` \| `LEGACY`. Only ACTIVE + LEGACY appear in search. |
| `source` | `lenders` | `SEED` (original list + manual adds) \| `FCA` (future auto-ingested) \| `OTHER` (sentinel). |
| `lender_other_name` | `products_considered` | Free text entered when adviser selects the Other sentinel. |
| `feed_id = 'FCA_LENDERS'` | `data_feed_status` | Updated by the cron on every run. |
