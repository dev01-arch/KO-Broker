-- Migration: billing_access
-- Paywall support: free-access grants, trial end, and the Stripe subscription state per organisation.
-- Additive only. Existing organisations are grandfathered by BILLING_PAYWALL_STARTS_AT (createdAt before it).

CREATE TYPE "OrgAccessGrant" AS ENUM ('NONE', 'COMPLIMENTARY', 'GRANDFATHERED');

ALTER TABLE "organisations"
  ADD COLUMN "accessGrant"          "OrgAccessGrant" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3),
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "subscriptionStatus"   TEXT,
  ADD COLUMN "currentPeriodEnd"     TIMESTAMP(3);
