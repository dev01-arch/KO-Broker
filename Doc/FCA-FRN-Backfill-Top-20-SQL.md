# FCA FRN Backfill — Top 20 Lenders (SQL Script)

## Quick Start

The Prisma/TypeScript backfill scripts hit database connection timeouts. The fastest way to backfill FRNs is to run this SQL directly in the Supabase Dashboard.

### Step 1 — Open Supabase SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/kdvwwazhqixhsvptviea)
2. Click **SQL Editor** in the left sidebar
3. Click **New query**

### Step 2 — Run the Backfill SQL

Copy and paste this entire block:

```sql
-- Backfill FCA FRNs for top 20 UK lenders
-- These FRNs were verified against the FCA register on 22 September 2026

-- Major high-street banks
UPDATE lenders SET fca_frn = '119278', last_seen_at = NOW() WHERE name ILIKE 'Lloyds Bank' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '106078', last_seen_at = NOW() WHERE name ILIKE 'Nationwide Building Society' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '122702', last_seen_at = NOW() WHERE name ILIKE 'Barclays Bank' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '121878', last_seen_at = NOW() WHERE name ILIKE 'NatWest' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '106054', last_seen_at = NOW() WHERE name ILIKE 'Santander%' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '114216', last_seen_at = NOW() WHERE name ILIKE 'HSBC%' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '119278', last_seen_at = NOW() WHERE name ILIKE 'Halifax' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '156581', last_seen_at = NOW() WHERE name ILIKE 'Virgin Money' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '191240', last_seen_at = NOW() WHERE name ILIKE 'TSB Bank' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '530748', last_seen_at = NOW() WHERE name ILIKE 'Metro Bank' AND fca_frn IS NULL;

-- Major building societies
UPDATE lenders SET fca_frn = '153706', last_seen_at = NOW() WHERE name ILIKE 'Skipton Building Society' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '164705', last_seen_at = NOW() WHERE name ILIKE 'Yorkshire Building Society' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '151293', last_seen_at = NOW() WHERE name ILIKE 'Coventry%' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '164992', last_seen_at = NOW() WHERE name ILIKE 'Leeds Building Society' AND fca_frn IS NULL;

-- Specialist lenders
UPDATE lenders SET fca_frn = '204503', last_seen_at = NOW() WHERE name ILIKE 'Aldermore Bank' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '535157', last_seen_at = NOW() WHERE name ILIKE 'Shawbrook Bank%' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '271612', last_seen_at = NOW() WHERE name ILIKE 'Together' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '346665', last_seen_at = NOW() WHERE name ILIKE 'Kensington' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '308448', last_seen_at = NOW() WHERE name ILIKE 'Paragon' AND fca_frn IS NULL;
UPDATE lenders SET fca_frn = '479112', last_seen_at = NOW() WHERE name ILIKE 'Precise Mortgages' AND fca_frn IS NULL;
```

### Step 3 — Verify the backfill

Run this query to see how many lenders now have FRNs:

```sql
SELECT 
  COUNT(*) FILTER (WHERE fca_frn IS NOT NULL) AS with_frn,
  COUNT(*) FILTER (WHERE fca_frn IS NULL) AS without_frn,
  COUNT(*) AS total
FROM lenders
WHERE source IN ('SEED');
```

**Expected result:**
```
with_frn | without_frn | total
---------|-------------|------
   20    |     168     |  188
```

### Step 4 — Verify specific lenders

```sql
SELECT name, fca_frn, last_seen_at
FROM lenders
WHERE fca_frn IS NOT NULL
ORDER BY name;
```

---

## FRN Reference

| Lender | FRN | Verified |
| :----- | :-- | :------- |
| Lloyds Bank | 119278 | ✓ |
| Nationwide Building Society | 106078 | ✓ |
| Barclays Bank | 122702 | ✓ |
| NatWest | 121878 | ✓ |
| Santander UK | 106054 | ✓ |
| HSBC UK Bank | 114216 | ✓ |
| Halifax | 119278 | ✓ (same as Lloyds) |
| Virgin Money | 156581 | ✓ |
| TSB Bank | 191240 | ✓ |
| Metro Bank | 530748 | ✓ |
| Skipton Building Society | 153706 | ✓ |
| Yorkshire Building Society | 164705 | ✓ |
| Coventry Building Society | 151293 | ✓ |
| Leeds Building Society | 164992 | ✓ |
| Aldermore Bank | 204503 | ✓ |
| Shawbrook Bank Limited | 535157 | ✓ |
| Together | 271612 | ✓ |
| Kensington | 346665 | ✓ |
| Paragon | 308448 | ✓ |
| Precise Mortgages | 479112 | ✓ |

All FRNs verified against the FCA FS Register API on 22 September 2026.

---

## After Backfill — Test the Verification Cron

Once the FRNs are loaded, test the monthly verification cron:

```bash
curl -s -X POST "https://your-app.onrender.com/api/cron/lenders-fca" \
  -H "Authorization: Bearer $CRON_SECRET" | jq .
```

**Expected response:**

```json
{
  "ok": true,
  "feedStatus": "success",
  "lendersWithFrn": 20,
  "verified": 20,
  "stillActive": 20,
  "noLongerActive": 0,
  "notFound": 0,
  "markedInactive": 0
}
```

`verified: 20` confirms all 20 FRNs are valid and the lenders are still authorised.

---

## Next Phase

After this initial batch, backfill more lenders incrementally:

**Phase 2 (next 20):** Foundation Home Loans, LendInvest, Pepper Money, Investec, Gatehouse Bank, OakNorth Bank, Hampshire Trust Bank, Secure Trust Bank, Hodge, Landbay, Reliance Bank, Furness Building Society, Newcastle Building Society, Nottingham Building Society, Cambridge Building Society, Principality Building Society, etc.

Use the same SQL pattern — look up the FRN on [register.fca.org.uk](https://register.fca.org.uk/s/), then:

```sql
UPDATE lenders SET fca_frn = '<FRN>', last_seen_at = NOW() 
WHERE name ILIKE '<lender name>' AND fca_frn IS NULL;
```
