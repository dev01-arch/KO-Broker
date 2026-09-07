-- Migration: adviser_access
-- Adds broker-side invite token fields and per-adviser visibility switches to users table.

ALTER TABLE "users"
  ADD COLUMN "inviteToken"       TEXT UNIQUE,
  ADD COLUMN "inviteTokenExpiry" TIMESTAMP(3),
  ADD COLUMN "invitePending"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canViewAllClients"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canViewAccountDetails" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "canViewAiSummaries"    BOOLEAN NOT NULL DEFAULT false;
