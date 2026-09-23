# FCA Lender Sync — Supabase Edge Function Architecture

## Why the Current Approach Is Wrong

The current implementation runs `runFcaIngest()` inside a Next.js API route at `/api/cron/lenders-fca`. That route is a serverless function. Here is the execution time problem:

The FCA API enforces a rate limit of 10 requests per 10 seconds. The ingest respects this with a 1200ms delay between every request. The job has three stages:

- **Stage 1:** Verify every lender with a known FRN — 1 request per lender × 1200ms delay
- **Stage 2:** Search 3 keyword terms, paginate results — 1 request per page
- **Stage 3:** Permission check on any firm not already in the DB — 1 request per unknown firm

At 189 lenders to verify, Stage 1 alone takes a minimum of **226 seconds** (189 × 1.2s). That is already over Vercel Pro's default function timeout and far over Render's 30-second HTTP response window.

The job will time out silently. The HTTP response never arrives. `DataFeedStatus` never gets updated. You will not know it failed.

Serverless functions are the wrong tool for a job that is deliberately slow by design.

---

## The Right Tool — Supabase Edge Functions

Supabase Edge Functions run on Deno Deploy at the edge. They are **not** serverless functions with timeouts. They run until the code finishes. There is no maximum execution duration for background invocations.

Because the project already uses Supabase as its database, the Edge Function infrastructure is already available at no extra cost. No new service. No new account. No new config.

The architecture looks like this:

```
pg_cron (inside Supabase Postgres)
  │
  │  fires on schedule via pg_net HTTP call
  ▼
Supabase Edge Function: fca-lender-sync
  │
  │  fetches FCA FS Register API (no timeout concern)
  ▼
Supabase Postgres (lenders table)
  │
  │  upsert new lenders, update lastSeenAt, mark INACTIVE
  ▼
DataFeedStatus row updated (feedId = 'FCA_LENDERS')
```

No Next.js. No serverless timeout. No Vercel cron. The Next.js route `/api/cron/lenders-fca` becomes a manual trigger only — available to the team to kick off an unscheduled sync, but not the primary scheduler.

---

## What a Supabase Edge Function Is

A Supabase Edge Function is a TypeScript/JavaScript function deployed to Supabase's global edge network. It is:

- Written in TypeScript (Deno runtime — same as Node.js but with native `fetch`, no `npm install`, imports via URL or `npm:` specifier)
- Deployed via the Supabase CLI: `supabase functions deploy fca-lender-sync`
- Invoked via an HTTPS URL: `https://<project-ref>.supabase.co/functions/v1/fca-lender-sync`
- Secured with a `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` header or a custom `FUNCTION_SECRET` env var
- Has access to all Supabase project env vars set in the dashboard
- Can connect directly to the Supabase Postgres database via the `SUPABASE_DB_URL` env var or the Supabase client library

The function lives in `supabase/functions/fca-lender-sync/index.ts` in your project.

---

## What pg_cron Is

`pg_cron` is a Postgres extension that runs SQL jobs on a schedule, directly inside the database. Supabase enables it by default on all projects.

You schedule a job with a single SQL statement:

```sql
select cron.schedule(
  'fca-lender-sync',           -- job name (unique)
  '0 6 1 * *',                  -- cron expression: 06:00 UTC on 1st of every month
  $$
    select net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/fca-lender-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon-or-service-key>"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
```

`pg_net` is a companion extension that lets Postgres make HTTP requests. The `net.http_post` call above fires asynchronously — the cron job itself returns immediately and `pg_net` handles the HTTP call in the background. The Edge Function then runs to completion at its own pace.

---

## The Complete Implementation Plan

### Step 1 — Install the Supabase CLI

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

### Step 2 — Link your project

```bash
cd /path/to/KO-Broker
supabase login
supabase link --project-ref <your-project-ref>
```

Your project ref is in the Supabase Dashboard URL: `https://supabase.com/dashboard/project/<project-ref>`.

### Step 3 — Create the Edge Function

```bash
supabase functions new fca-lender-sync
```

This creates `supabase/functions/fca-lender-sync/index.ts`.

### Step 4 — Write the function

Replace the generated file with the full ingest logic (see Step 4a below). The logic is identical to `lenders-fca-ingest.ts` but written for the Deno runtime. The key differences:

- Import Postgres client via `npm:postgres` or use `SUPABASE_DB_URL` directly
- `fetch()` is native — no polyfill needed
- No `process.env` — use `Deno.env.get('VAR_NAME')`
- No `node_modules` — import from `npm:` specifiers or Deno CDN

### Step 4a — The function code

```typescript
// supabase/functions/fca-lender-sync/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2';

const FCA_API_BASE = 'https://register.fca.org.uk/services/V0.1';
const REQUEST_DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const normalise = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

Deno.serve(async (req) => {
  // Auth check — validate the function secret
  const functionSecret = Deno.env.get('FUNCTION_SECRET');
  if (functionSecret) {
    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${functionSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const fcaEmail = Deno.env.get('FCA_API_EMAIL');
  const fcaKey   = Deno.env.get('FCA_API_KEY');

  if (!fcaEmail || !fcaKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'FCA_API_EMAIL and FCA_API_KEY are required' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── FCA fetch helper ────────────────────────────────────────────────────
  const fcaFetch = async (path: string) => {
    await sleep(REQUEST_DELAY_MS);
    const res = await fetch(`${FCA_API_BASE}${path}`, {
      headers: { 'X-Auth-Email': fcaEmail, 'X-Auth-Key': fcaKey, Accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`FCA API ${res.status} on ${path}`);
    return res.json();
  };

  let verified = 0, notFound = 0, inserted = 0, alreadyKnown = 0, markedInactive = 0;

  try {
    // ── Stage 1: verify existing lenders by FRN ─────────────────────────
    const { data: existing } = await supabase
      .from('lenders')
      .select('id, name, fca_frn, status')
      .not('fca_frn', 'is', null)
      .in('source', ['SEED', 'FCA']);

    for (const lender of existing ?? []) {
      try {
        const detail: any = await fcaFetch(`/Firm/${encodeURIComponent(lender.fca_frn)}`);
        if (!detail?.Data?.[0]) { notFound++; continue; }

        const isActive = detail.Data[0]['Current Authorisation Status Description']
          ?.toLowerCase().includes('authorised');

        await supabase.from('lenders').update({ last_seen_at: new Date().toISOString() })
          .eq('id', lender.id);

        if (!isActive) {
          const { count: prodRefs } = await supabase.from('products_considered')
            .select('*', { count: 'exact', head: true }).eq('lender_id', lender.id);
          const { count: caseRefs } = await supabase.from('cases')
            .select('*', { count: 'exact', head: true }).eq('lender_id', lender.id);
          if (!prodRefs && !caseRefs) {
            await supabase.from('lenders').update({ status: 'INACTIVE' }).eq('id', lender.id);
            markedInactive++;
          }
        }
        verified++;
      } catch (e) {
        console.warn(`[fca-sync] Could not verify ${lender.name}:`, e);
      }
    }

    // ── Stage 2: discover new mortgage lenders ─────────────────────────
    const searchTerms = ['mortgage', 'building society', 'home loans'];

    for (const term of searchTerms) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const result: any = await fcaFetch(`/Firm/Search?q=${encodeURIComponent(term)}&page=${page}`);
        if (!result?.Data?.length) { hasMore = false; break; }

        for (const firm of result.Data) {
          const frn  = firm['FCA Firm Reference Number'];
          const name = firm['Organisation Name']?.trim();
          if (!frn || !name) continue;
          if (!['Authorised', 'Registered'].includes(firm.Status ?? '')) continue;

          const normName = normalise(name);

          const { data: byName } = await supabase.from('lenders')
            .select('id, fca_frn').eq('normalized_name', normName).single();
          const { data: byFrn } = await supabase.from('lenders')
            .select('id').eq('fca_frn', frn).single();

          if (byName || byFrn) {
            if (byName && !byName.fca_frn) {
              await supabase.from('lenders')
                .update({ fca_frn: frn, last_seen_at: new Date().toISOString() })
                .eq('id', byName.id);
            } else if (byFrn) {
              await supabase.from('lenders')
                .update({ last_seen_at: new Date().toISOString() }).eq('id', byFrn.id);
            }
            alreadyKnown++;
            continue;
          }

          // Permission check
          const perms: any = await fcaFetch(`/Firm/${encodeURIComponent(frn)}/Permissions`);
          const hasMortgage = perms?.Data?.some((p: any) =>
            p['Regulated Activity']?.toLowerCase().includes('regulated mortgage contract'));
          if (!hasMortgage) continue;

          const { error } = await supabase.from('lenders').insert({
            name,
            normalized_name: normName,
            fca_frn: frn,
            status: 'ACTIVE',
            source: 'FCA',
            last_seen_at: new Date().toISOString(),
          });
          if (!error) { inserted++; console.log(`[fca-sync] New: ${name}`); }
        }

        const total = parseInt(result.ResultInfo?.total_count ?? '0', 10);
        const perPage = parseInt(result.ResultInfo?.per_page ?? '25', 10);
        hasMore = page * perPage < total;
        page++;
      }
    }

    // ── Update DataFeedStatus ────────────────────────────────────────────
    await supabase.from('data_feed_status').upsert({
      feed_id: 'FCA_LENDERS',
      last_attempt_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'feed_id' });

    const report = { ok: true, feedStatus: 'success', verified, notFound, inserted, alreadyKnown, markedInactive };
    console.log('[fca-sync] Complete:', report);
    return new Response(JSON.stringify(report), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fca-sync] Failed:', message);

    await supabase.from('data_feed_status').upsert({
      feed_id: 'FCA_LENDERS',
      last_attempt_at: new Date().toISOString(),
      last_error: message,
    }, { onConflict: 'feed_id' });

    return new Response(JSON.stringify({ ok: false, feedStatus: 'failure', error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### Step 5 — Set Edge Function environment variables

In the Supabase Dashboard → Project → Edge Functions → Manage secrets, add:

```
FCA_API_EMAIL          = your-registered-email@domain.com
FCA_API_KEY            = your-fca-api-key
FUNCTION_SECRET        = a-random-secret-string-you-choose
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase — you do not need to set them.

### Step 6 — Deploy the Edge Function

```bash
supabase functions deploy fca-lender-sync --no-verify-jwt
```

`--no-verify-jwt` disables Supabase's default JWT requirement and lets you use your own `FUNCTION_SECRET` check instead (already in the code above).

The function URL will be:
```
https://<project-ref>.supabase.co/functions/v1/fca-lender-sync
```

### Step 7 — Schedule with pg_cron

Run this SQL in the Supabase Dashboard → SQL Editor:

```sql
-- Enable pg_net if not already enabled
create extension if not exists pg_net;

-- Schedule the FCA sync: 06:00 UTC on the 1st of every month
select cron.schedule(
  'fca-lender-sync',
  '0 6 1 * *',
  format(
    $$
      select net.http_post(
        url := 'https://%s.supabase.co/functions/v1/fca-lender-sync',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      );
    $$,
    '<your-project-ref>',
    '<your-FUNCTION_SECRET>'
  )
);
```

Verify the job was created:

```sql
select jobid, jobname, schedule, active from cron.job;
```

### Step 8 — Remove the Vercel cron entry (optional)

The Next.js `/api/cron/lenders-fca` route becomes a manual trigger. You can keep it for on-demand runs but it should no longer be the scheduled mechanism. Remove or comment out the entry in `vercel.json`:

```json
// Remove this entry:
{ "path": "/api/cron/lenders-fca", "schedule": "0 6 1 * *" }
```

The other three cron entries (message digests, BoE rates, HMLR prices) are fast operations (< 30 seconds each) and are fine staying in `vercel.json`.

---

## How to Trigger Manually (On-Demand)

To run an unscheduled sync — for example, after the FCA API key is first configured, or to test:

```bash
curl -s -X POST \
  https://<project-ref>.supabase.co/functions/v1/fca-lender-sync \
  -H "Authorization: Bearer <your-FUNCTION_SECRET>" \
  -H "Content-Type: application/json" \
  | jq .
```

Expected response:

```json
{
  "ok": true,
  "feedStatus": "success",
  "verified": 45,
  "notFound": 2,
  "inserted": 3,
  "alreadyKnown": 180,
  "markedInactive": 0
}
```

---

## How to Monitor

### In the Supabase Dashboard

**Job run history** — Supabase Dashboard → Cron → Jobs → click the job name → History. Shows every run with timestamp and status.

**Edge Function logs** — Supabase Dashboard → Edge Functions → `fca-lender-sync` → Logs. Shows the console output from each invocation, including which new lenders were inserted.

**DataFeedStatus** — Query directly:

```sql
select feed_id, last_success_at, last_attempt_at, last_error
from data_feed_status
where feed_id = 'FCA_LENDERS';
```

### Via the existing API

The dashboard bootstrap and Intelligence overview already surface `DataFeedStatus`. Once the Edge Function runs, `feedId: 'FCA_LENDERS'` will appear alongside `BOE_RATES` and `HMLR_PRICES`.

### pg_cron job run details

```sql
select
  jobid,
  start_time,
  end_time,
  status,
  return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'fca-lender-sync')
order by start_time desc
limit 10;
```

---

## Why This Architecture Beats Every Alternative

| Approach | Timeout risk | Cost | Complexity | Reliability |
| :---- | :---- | :---- | :---- | :---- |
| **Supabase Edge Function + pg_cron** | None (no timeout) | Free (included with Supabase) | Low — one file, CLI deploy | High — runs on Supabase's infrastructure, same SLA as your DB |
| Next.js API route + Vercel cron | High — 60–800s limit vs 5–30min job | Included but unreliable | Zero extra files | Low — will time out on large datasets |
| Next.js API route + Render cron | High — 30s HTTP timeout | Free tier on Render | Extra Render config | Low — same timeout problem |
| Next.js API route + chunked cursor | None if done right | Included | High — extra table, 5-min polling route, state machine | Medium — more moving parts |
| External cron service (Zeplo, Inngest, etc.) | None | Paid ($9–$25/mo for reliable tier) | Medium — new service, new auth | High — purpose-built |
| pg_cron calling Next.js route directly | Medium — depends on platform | Free | Low | Medium — tied to app deployment |

Supabase Edge Function + pg_cron wins on every axis for this specific job because:

1. Both tools are already provisioned in your Supabase project
2. The Edge Function has no execution timeout
3. The pg_cron schedule is stored in the database itself — it survives app redeployments
4. Logs and run history are in the Supabase dashboard — one place to check
5. The job has direct database access via the Supabase client — no round-trip through the app API
6. Zero new accounts, zero new monthly costs

---

## What to Keep in the Next.js App

The Next.js route at `/api/cron/lenders-fca` stays as-is, because:

- It provides a manual trigger the team can hit from Postman/curl without needing Supabase CLI access
- It serves as a fallback if the Edge Function deployment is delayed
- Its existing auth (`CRON_SECRET`) is independent of the Edge Function secret

Just remove it from `vercel.json` so it is no longer called on a schedule. The code stays.

---

## Environment Variables Checklist

| Variable | Where to set | Used by |
| :---- | :---- | :---- |
| `FCA_API_EMAIL` | Supabase Dashboard → Edge Functions → Secrets | Edge Function |
| `FCA_API_KEY` | Supabase Dashboard → Edge Functions → Secrets | Edge Function |
| `FUNCTION_SECRET` | Supabase Dashboard → Edge Functions → Secrets | Edge Function auth |
| `SUPABASE_URL` | Auto-injected by Supabase | Edge Function (automatic) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase | Edge Function (automatic) |
| `FCA_API_EMAIL` | `apps/web/.env.local` | Next.js manual trigger route |
| `FCA_API_KEY` | `apps/web/.env.local` | Next.js manual trigger route |
| `CRON_SECRET` | `apps/web/.env.local` | Next.js manual trigger route auth |

The Edge Function and the Next.js route are fully independent — they can have different secrets. The Edge Function uses `FUNCTION_SECRET`, the Next.js route uses `CRON_SECRET`.

---

## Summary

The FCA lender sync cannot reliably run inside a serverless function because the FCA rate limit forces execution time into the 5–30 minute range — longer than any serverless platform's timeout. The correct solution is a Supabase Edge Function (no timeout, Deno runtime, direct DB access) triggered by a `pg_cron` schedule stored inside Postgres. Both tools are already part of your Supabase subscription. The full implementation is 7 steps: install CLI, link project, create function, write code, set secrets, deploy, schedule with SQL.
