# FCA Lender Sync — Architecture Decision Record

## Status: Revised

This document records why the original automated-discovery approach was rejected
and what the correct architecture is. It supersedes the earlier version that
proposed a Supabase Edge Function running full keyword-search discovery.

---

## Original Approach (Rejected)

The first implementation ran `discoverNewLenders()` inside a Next.js cron route.
That function searched the FCA register using keyword terms ("mortgage",
"building society", "home loans"), paginated through all results, and checked
each firm's permissions before inserting new rows.

**Why it was rejected:**

1. **Execution time exceeds serverless limits.** The FCA API enforces 10 requests
   per 10 seconds. Discovery over the full register takes 5–30 minutes.
   Vercel's default function timeout is 60 seconds on the free plan; 300 seconds
   on Pro. Render's HTTP timeout is 30 seconds. The job would silently time out
   on every platform.

2. **Discovery via keyword search is noisy.** "Mortgage" returns thousands of
   brokers, packagers, and second-charge lenders alongside actual lenders.
   Filtering by permission helps, but the result still requires human review
   to avoid inserting wrong firms. The algorithm cannot distinguish
   "Lloyds Bank" (a lender) from "Lloyds Financial Planning Ltd" (a broker)
   without a human making that judgment.

3. **Discovery is solving a problem that doesn't exist.** The seed contains 189
   names covering the entire UK residential mortgage market. New lenders enter
   the market rarely — 2–5 per year at most. Automated sweeps every month
   produce noise (many near-duplicate names, fuzzy matches) while the actual
   new entrants are immediately visible from real adviser usage via the Other
   field.

---

## Revised Approach (Implemented)

Split the job into two distinct concerns with different owners:

### Automated: Verification only

**What:** Monthly cron checks that lenders already in the DB with a known FRN
are still authorised. No search, no fuzzy matching, no discovery.

**Why this is safe to automate:** The job is bounded and deterministic. It
processes exactly the rows in the `lenders` table that have a `fcaFrn`. The
number of such rows grows slowly and predictably. At 190 lenders × 1200ms per
request the job takes ~4 minutes — well within any serverless timeout.

**Where it runs:** Next.js API route `/api/cron/lenders-fca`, scheduled monthly
in `vercel.json` (or Render, or Supabase Cron — see below).

**What it does:**
1. For each lender with a `fcaFrn`: call `GET /Firm/{FRN}`, update `lastSeenAt`
2. After verifying all FRNs: any FCA-sourced lender with `lastSeenAt` older than
   32 days (two monthly runs) that has no ProductConsidered or Case references
   gets marked `INACTIVE`
3. Updates `DataFeedStatus { feedId: 'FCA_LENDERS' }` on every run

### Human-driven: Discovery

**What:** D&E reviews the Other-usage report monthly, looks up unfamiliar names
on the FCA register's own search UI, and adds confirmed lenders manually.

**Why this is better than automation:** The Other field already captures
discovery signal. When three advisers enter "Perenna" as Other across different
cases, that is a stronger and cleaner signal than a keyword sweep. A human
reviewing those names takes 10 minutes. The FCA register's own web search UI
(`register.fca.org.uk`) is far better at disambiguation than the V0.1 API.

**How it works:**
1. `GET /api/admin/lenders/other-usage` — ranked list of Other-field entries
   grouped by name with usage count, first/last seen, case references, and a
   flag for whether the name is already in the directory
2. D&E opens the FCA register web search for any name appearing 3+ times
3. Confirms the FRN and that the firm has "Entering into a regulated mortgage
   contract" permission
4. `POST /api/admin/lenders` — adds the confirmed lender with name and FRN

---

## Should This Use a Supabase Edge Function?

The previous version of this document proposed moving the cron to a Supabase
Edge Function to avoid serverless timeouts. **That is no longer necessary.**

With discovery removed, the verification-only job processes ~190 FRNs in ~4
minutes. That fits inside:
- Vercel Pro default (300 seconds)
- Render with an extended timeout
- A Supabase Edge Function (still valid if preferred)

The Next.js route is the simplest option and requires no new infrastructure.

**If the number of lenders with known FRNs grows significantly** (e.g. above
~200 rows with FRNs, which would push execution past 4 minutes), moving to a
Supabase Edge Function remains the right long-term answer. The steps are:

```
supabase functions new fca-lender-sync
# Write verification-only logic in Deno TypeScript
supabase functions deploy fca-lender-sync --no-verify-jwt
# Schedule via pg_cron + pg_net:
select cron.schedule(
  'fca-lender-sync', '0 6 1 * *',
  $$ select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/fca-lender-sync',
    headers := '{"Authorization": "Bearer <FUNCTION_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
# Remove from vercel.json
```

The ingest logic in `lib/api/lenders-fca-ingest.ts` is structured to be portable
to a Deno Edge Function with minimal changes (replace `prisma` with the Supabase
JS client, replace `process.env` with `Deno.env.get`).

---

## Architecture Diagram

```
Monthly (1st of month, 06:00 UTC)
  │
  │  Scheduled by vercel.json cron or pg_cron
  ▼
POST /api/cron/lenders-fca
  │
  │  runFcaIngest()
  ▼
lib/api/lenders-fca-ingest.ts
  ├── verifyExistingLenders()
  │     For each lender WHERE fcaFrn IS NOT NULL:
  │       GET /Firm/{FRN} → update lastSeenAt
  │
  └── markLongAbsentInactive()
        For each FCA lender WHERE lastSeenAt < 32 days ago
        AND no ProductConsidered/Case references:
          SET status = INACTIVE

        DataFeedStatus.upsert { feedId: 'FCA_LENDERS' }


When an adviser uses Other + free text
  │
  ▼
ProductConsidered { lenderId: Other.id, lenderOtherName: 'Perenna' }

Once a month, D&E reviews:
GET /api/admin/lenders/other-usage
  → Ranked list of unrecognised names
  → D&E checks FCA register web UI
  → Confirms FRN + mortgage permission

POST /api/admin/lenders { name: 'Perenna', fcaFrn: '123456' }
  → New lender row inserted
  → Appears in GET /api/lenders search immediately
```

---

## Environment Variables

| Variable | Required for | Where to set |
| :---- | :---- | :---- |
| `FCA_API_EMAIL` | Cron verification | `.env.local` / Vercel / Render |
| `FCA_API_KEY` | Cron verification | `.env.local` / Vercel / Render |
| `CRON_SECRET` | Cron auth | `.env.local` / Vercel / Render |

The admin endpoints (`/api/admin/lenders*`) use Clerk session auth with
`requiredRole: 'ADMIN'` — no additional env vars needed.
