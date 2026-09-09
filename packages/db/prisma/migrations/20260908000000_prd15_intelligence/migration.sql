-- PRD-15: Mortgage Intelligence migration
-- Additive only migration: creates rate_series_points, postcode_geography,
-- local_price_stats, data_feed_status, case_intelligence_snapshots tables and enums.

-- ── New enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "IntelligenceSource" AS ENUM ('MANUAL', 'CONFIRMED_FROM_CASE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketSignal" AS ENUM ('IMPROVING', 'STABLE', 'WORSENING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── rate_series_points ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "rate_series_points" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "seriesId"    TEXT         NOT NULL,
  "label"       TEXT         NOT NULL,
  "value"       DOUBLE PRECISION NOT NULL,
  "validFrom"   TIMESTAMPTZ  NOT NULL,
  "validTo"     TIMESTAMPTZ,
  "retrievedAt" TIMESTAMPTZ  NOT NULL,
  "source"      TEXT         NOT NULL,
  "rawRef"      TEXT,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "rate_series_points_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rate_series_points_seriesId_validFrom_idx"
  ON "rate_series_points" ("seriesId", "validFrom");

-- ── postcode_geography ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "postcode_geography" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "postcode"      TEXT         NOT NULL,
  "outwardCode"   TEXT         NOT NULL,
  "lat"           DOUBLE PRECISION,
  "lng"           DOUBLE PRECISION,
  "region"        TEXT,
  "adminDistrict" TEXT,
  "lsoa"          TEXT,
  "msoa"          TEXT,
  "constituency"  TEXT,
  "cachedAt"      TIMESTAMPTZ  NOT NULL,
  "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "postcode_geography_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "postcode_geography_postcode_key" UNIQUE ("postcode")
);

CREATE INDEX IF NOT EXISTS "postcode_geography_outwardCode_idx"
  ON "postcode_geography" ("outwardCode");

-- ── local_price_stats ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "local_price_stats" (
  "id"              TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "outwardCode"     TEXT         NOT NULL,
  "asOf"            TIMESTAMPTZ  NOT NULL,
  "medianPrice"     DOUBLE PRECISION NOT NULL,
  "medianPrice12m"  DOUBLE PRECISION,
  "change12mPct"    DOUBLE PRECISION,
  "txnCount12m"     INTEGER      NOT NULL,
  "retrievedAt"     TIMESTAMPTZ  NOT NULL,
  "source"          TEXT         NOT NULL DEFAULT 'HMLR_PPD',
  CONSTRAINT "local_price_stats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "local_price_stats_outwardCode_asOf_key" UNIQUE ("outwardCode", "asOf")
);

CREATE INDEX IF NOT EXISTS "local_price_stats_outwardCode_idx"
  ON "local_price_stats" ("outwardCode");

-- ── data_feed_status ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "data_feed_status" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "feedId"        TEXT        NOT NULL,
  "lastSuccessAt" TIMESTAMPTZ,
  "lastAttemptAt" TIMESTAMPTZ,
  "lastError"     TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "data_feed_status_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "data_feed_status_feedId_key" UNIQUE ("feedId")
);

-- ── case_intelligence_snapshots ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "case_intelligence_snapshots" (
  "id"                TEXT              NOT NULL DEFAULT gen_random_uuid()::text,
  "orgId"             TEXT              NOT NULL,
  "caseId"            TEXT,
  "source"            "IntelligenceSource" NOT NULL,
  "confirmedAt"       TIMESTAMPTZ,
  "generatedAt"       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "postcode"          TEXT              NOT NULL,
  "outwardCode"       TEXT              NOT NULL,
  "propertyValue"     DOUBLE PRECISION  NOT NULL,
  "deposit"           DOUBLE PRECISION,
  "mortgageAmount"    DOUBLE PRECISION  NOT NULL,
  "termYears"         INTEGER           NOT NULL,
  "grossIncome"       DOUBLE PRECISION,
  "secondIncome"      DOUBLE PRECISION,
  "monthlyCommitments" DOUBLE PRECISION,
  "ltv"               DOUBLE PRECISION,
  "lti"               DOUBLE PRECISION,
  "dti"               DOUBLE PRECISION,
  "dtiBand"           TEXT,
  "monthlyPayment"    DOUBLE PRECISION,
  "marketSignal"      "MarketSignal",
  "insightText"       TEXT              NOT NULL,
  "watchText"         TEXT,
  "inputsJson"        JSONB             NOT NULL,
  "outputsJson"       JSONB             NOT NULL,
  "sourcesJson"       JSONB             NOT NULL,
  "createdAt"         TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT "case_intelligence_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "case_intelligence_snapshots_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "organisations" ("id"),
  CONSTRAINT "case_intelligence_snapshots_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "cases" ("id")
);

CREATE INDEX IF NOT EXISTS "case_intelligence_snapshots_orgId_generatedAt_idx"
  ON "case_intelligence_snapshots" ("orgId", "generatedAt");

CREATE INDEX IF NOT EXISTS "case_intelligence_snapshots_orgId_caseId_idx"
  ON "case_intelligence_snapshots" ("orgId", "caseId");
