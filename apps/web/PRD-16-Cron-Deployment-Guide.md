# KO Broker Platform — Cron Jobs & Deployment Guide

## What This Document Covers

1. What each cron job does
2. Environment variables required for the full platform
3. How to deploy cron jobs on **Vercel** (automatic)
4. How to deploy cron jobs on **Render** (manual setup)
5. How to test cron jobs manually
6. Monitoring and troubleshooting

---

## The Four Cron Jobs

| Job | Path | Schedule | Purpose |
| :---- | :---- | :---- | :---- |
| Message Email Digests | `/api/cron/message-email-digests` | `0 6 * * *` (daily 06:00 UTC) | Sends batched email notifications to clients with unread messages |
| BoE Rate Ingest | `/api/cron/intelligence-rates` | `0 7 * * *` (daily 07:00 UTC) | Fetches Bank of England mortgage rate data for Mortgage Intel module |
| HMLR Price Ingest | `/api/cron/intelligence-prices` | `0 8 * * *` (daily 08:00 UTC) | Fetches Land Registry sold price data for local area comparisons |
| FCA Lender Sync | `/api/cron/lenders-fca` | `0 6 1 * *` (monthly, 1st 06:00 UTC) | Keeps lender directory current against FCA FS Register |

All four are HTTP endpoints in the Next.js app. Any scheduler calls them with `Authorization: Bearer {CRON_SECRET}`.

---

## What Each Cron Job Does in Detail

### 1. Message Email Digests (`/api/cron/message-email-digests`)

Processes delayed notification emails for clients. When an adviser sends a message to a client, the platform does not send an email immediately. Instead it schedules a `MessageEmailDigest` row. This cron fires daily and sends the digest email to clients who still have unread messages.

- Processes up to 50 digests per run
- Skips clients who have already read their messages before the digest fires
- Respects per-client email opt-out preferences
- Clears cancelled digests automatically

**Requires:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `DATABASE_URL`, `CRON_SECRET`

---

### 2. BoE Rate Ingest (`/api/cron/intelligence-rates`)

Fetches Bank of England quoted mortgage rate data for five statistical series:

- 2-year fixed rate (75% LTV)
- 5-year fixed rate (75% LTV)
- Variable rate (75% LTV)
- Effective rate — new mortgages
- Effective rate — outstanding mortgages

Stores results as `RateSeriesPoint` rows. Powers the rate cards and market signal (IMPROVING / STABLE / WORSENING) in the Mortgage Intelligence module. No-ops if current month is already ingested.

**Requires:** `DATABASE_URL`, `CRON_SECRET`

---

### 3. HMLR Price Ingest (`/api/cron/intelligence-prices`)

Fetches HM Land Registry Price Paid Data aggregates for outward postcodes (e.g. SW1A, E1, M1). Stores median sold prices and 12-month change in `LocalPriceStat`. Powers the "vs local median" comparison in Mortgage Intelligence snapshots.

Only processes postcodes that already exist in `PostcodeGeography` (populated when advisers run Intel on a case). Processes up to 50 outward codes per run. No-ops if no postcodes need updating.

**Requires:** `DATABASE_URL`, `CRON_SECRET`

---

### 4. FCA Lender Sync (`/api/cron/lenders-fca`)

Keeps the lender directory current against the FCA Financial Services Register. The platform ships with 189 lenders seeded from a static list. This cron runs monthly and:

**Stage 1 — Verify existing lenders**
For every lender in the DB with a known FRN (Firm Reference Number), calls `GET /Firm/{FRN}` on the FCA API. Updates `lastSeenAt` on confirmed-active firms.

**Stage 2 — Discover new lenders**
Searches the FCA register for firms matching `"mortgage"`, `"building society"`, and `"home loans"`. For each result not already in the DB, checks whether the firm has the **"Entering into a regulated mortgage contract"** permission. If yes, inserts a new `Lender` row with `source: FCA`.

**Stage 3 — Mark departed lenders INACTIVE**
Any FCA-sourced lender with `lastSeenAt` older than 32 days (two monthly run grace period) is marked `INACTIVE`. Safety check: never marks a lender INACTIVE if it's referenced by any active case or product.

**Requires:** `FCA_API_EMAIL`, `FCA_API_KEY`, `DATABASE_URL`, `CRON_SECRET`

**FCA API key:** Free. Register at [register.fca.org.uk/developer/s/](https://register.fca.org.uk/developer/s/)

---

## Environment Variables — Complete Reference

Copy `apps/web/.env.local.example` to `apps/web/.env.local` and fill in all values.

### Required (platform will not start without these)

| Variable | Where to get it |
| :---- | :---- |
| `DATABASE_URL` | Supabase Dashboard → Project Settings → Database → Connection string (Transaction mode, port 6543) |
| `DIRECT_URL` | Supabase Dashboard → same page (Session mode, port 5432) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard → Webhooks → signing secret |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL e.g. `https://app.ko-broker.com` |
| `NEXT_PUBLIC_CLIENT_PORTAL_URL` | Client portal URL e.g. `https://portal.ko-broker.com` |
| `PORTAL_SESSION_SECRET` | Generate: `openssl rand -hex 32` |

### Required for cron jobs

| Variable | Used by | Notes |
| :---- | :---- | :---- |
| `CRON_SECRET` | All 4 cron jobs | Generate: `openssl rand -hex 32`. Must match on web service and cron job. |
| `FCA_API_EMAIL` | `/api/cron/lenders-fca` | Email used to register at FCA Developer Portal |
| `FCA_API_KEY` | `/api/cron/lenders-fca` | API key from FCA Developer Portal |

### Required for email

| Variable | Notes |
| :---- | :---- |
| `RESEND_API_KEY` | From [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | Must be a verified domain in Resend |
| `RESEND_FROM_NAME` | Optional display name e.g. `KO Platform` |
| `RESEND_REPLY_TO` | Optional reply-to address |

### Required for file uploads

| Variable | Notes |
| :---- | :---- |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 → Manage R2 API Tokens |
| `R2_SECRET_ACCESS_KEY` | Same |
| `R2_BUCKET_NAME` | Name of your R2 bucket |
| `R2_PUBLIC_URL` | Public URL of the bucket |

### Required for SMS

| Variable | Notes |
| :---- | :---- |
| `TWILIO_ACCOUNT_SID` | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_FROM_NUMBER` | Verified Twilio number in E.164 format |

### Required for billing

| Variable | Notes |
| :---- | :---- |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same page |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks |
| `STRIPE_PRICE_STARTER_MONTHLY` etc. | Create products in Stripe Dashboard |

### Optional tuning

| Variable | Default | Notes |
| :---- | :---- | :---- |
| `MESSAGE_EMAIL_DIGEST_DELAY_HOURS` | `4` | Hours to wait before sending digest |
| `MESSAGE_EMAIL_DIGEST_DELAY_MS` | — | Override in ms for testing |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated allowed origins |
| `KO_ENFORCE_PLAN_LIMITS` | `false` | Enable Stripe plan enforcement |
| `NEXT_PUBLIC_ENFORCE_PLAN_LIMITS` | `false` | Browser-side plan enforcement |

---

## Deploying on Vercel (automatic)

Vercel reads `apps/web/vercel.json` and registers the cron jobs automatically when you deploy. No extra setup needed.

### What's already configured in `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/message-email-digests", "schedule": "0 6 * * *" },
    { "path": "/api/cron/intelligence-rates",    "schedule": "0 7 * * *" },
    { "path": "/api/cron/intelligence-prices",   "schedule": "0 8 * * *" },
    { "path": "/api/cron/lenders-fca",           "schedule": "0 6 1 * *" }
  ]
}
```

### Steps

1. Connect your repository to Vercel
2. Set the root directory to `apps/web` in your Vercel project settings
3. Add all environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**
4. Deploy — Vercel picks up the cron schedule from `vercel.json` automatically
5. View cron status: Vercel Dashboard → Project → **Cron Jobs** tab

**Note:** Vercel injects `CRON_SECRET` automatically when it calls the cron routes — you still need to set it in the environment variables so the route can validate it.

---

## Deploying on Render (manual setup)

Render does not read `vercel.json`. You create each cron job as a separate **Cron Job** service in the Render dashboard.

### Prerequisites

- Web service deployed on Render with all env vars set (see complete reference above)
- Your deployed URL noted (e.g. `https://ko-broker.onrender.com`)
- `CRON_SECRET` set on the web service

### Creating a Cron Job on Render

For each job below:

1. **Render Dashboard → New → Cron Job**
2. Fill in **Name**, **Schedule**, and **Command** from the table below
3. Add environment variable: `CRON_SECRET=your-secret` (same value as on the web service)
4. **Save**

### The four jobs

**Job 1 — Message Email Digests**
```
Name:     ko-broker-message-digests
Schedule: 0 6 * * *
Command:  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/message-email-digests
```

**Job 2 — BoE Rate Ingest**
```
Name:     ko-broker-boe-rates
Schedule: 0 7 * * *
Command:  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/intelligence-rates
```

**Job 3 — HMLR Price Ingest**
```
Name:     ko-broker-hmlr-prices
Schedule: 0 8 * * *
Command:  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/intelligence-prices
```

**Job 4 — FCA Lender Sync**
```
Name:     ko-broker-fca-lenders
Schedule: 0 6 1 * *
Command:  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.onrender.com/api/cron/lenders-fca
```

For Job 4, also add `FCA_API_EMAIL` and `FCA_API_KEY` to the cron job's environment variables.

**Note on `curl -fsS`:**
- `-f` — fail with a non-zero exit code on HTTP errors (4xx/5xx). Render marks the cron run as failed if the job returns an error status.
- `-s` — silent mode (no progress bar)
- `-S` — show error messages even in silent mode

---

## Testing Cron Jobs Manually

Run these from your terminal before relying on the scheduler. Replace the URL and secret.

```bash
APP_URL="https://your-app.onrender.com"   # or your Vercel URL
SECRET="your-cron-secret"

# 1. Message digests
curl -s -X POST "$APP_URL/api/cron/message-email-digests" \
  -H "Authorization: Bearer $SECRET" | jq .

# 2. BoE rates
curl -s -X POST "$APP_URL/api/cron/intelligence-rates" \
  -H "Authorization: Bearer $SECRET" | jq .

# 3. HMLR prices
curl -s -X POST "$APP_URL/api/cron/intelligence-prices" \
  -H "Authorization: Bearer $SECRET" | jq .

# 4. FCA lender sync
curl -s -X POST "$APP_URL/api/cron/lenders-fca" \
  -H "Authorization: Bearer $SECRET" | jq .
```

### What to expect

| HTTP Status | Meaning |
| :---- | :---- |
| `200 { "ok": true }` | Job ran and succeeded |
| `200 { "feedStatus": "no-op" }` | Ran but nothing needed updating — normal |
| `401` | Wrong `CRON_SECRET` — check it matches on both sides |
| `503 { "error": "FCA_API_EMAIL and FCA_API_KEY are required" }` | FCA credentials not set |
| `503 { "error": "CRON_SECRET is required in production" }` | `CRON_SECRET` not set on web service |
| `500 { "ok": false }` | Job ran but failed — check logs for error detail |

---

## Monitoring

### Via database

The `data_feed_status` table tracks the last run for the three data ingest cron jobs. Run this to check all feeds:

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const feeds = await p.dataFeedStatus.findMany({ orderBy: { feedId: 'asc' } });
  for (const f of feeds) {
    console.log(f.feedId.padEnd(20), 'last success:', f.lastSuccessAt?.toISOString() ?? 'NEVER', f.lastError ? '| ERROR: ' + f.lastError : '');
  }
  await p.\$disconnect();
})();
"
```

A healthy system shows:

| Feed | Expected last success |
| :---- | :---- |
| `BOE_RATES` | Within last 24 hours |
| `HMLR_PRICES` | Within last 24 hours (or recent if no postcodes to update) |
| `FCA_LENDERS` | Within last 32 days |

### Via platform UI

The Mortgage Intelligence overview (`GET /api/intelligence/overview`) surfaces `feedStatuses` in its response — the same data shown on the Intelligence page in the dashboard.

---

## FCA API Key — Setup Instructions

1. Go to [register.fca.org.uk/developer/s/](https://register.fca.org.uk/developer/s/)
2. Click **Register** and create an account with your business email
3. Once registered, go to **My Account → API Keys**
4. Generate a new key — copy both the email and the key value
5. Add to your environment:
   ```
   FCA_API_EMAIL=the-email-you-registered-with
   FCA_API_KEY=the-key-value-from-the-portal
   ```
6. The lender sync cron will start working on the next scheduled run

The FCA API is free. Rate limit is 10 requests per 10 seconds. The ingest uses a 1200ms delay between requests to stay within this safely.

---

## Cron Schedule Reference

Standard 5-field POSIX cron: `minute hour day-of-month month day-of-week`

| Expression | Human description |
| :---- | :---- |
| `0 6 * * *` | Every day at 06:00 UTC |
| `0 7 * * *` | Every day at 07:00 UTC |
| `0 8 * * *` | Every day at 08:00 UTC |
| `0 6 1 * *` | 1st of every month at 06:00 UTC |
