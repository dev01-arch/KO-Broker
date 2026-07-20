-- Adviser invite + visibility columns on users
-- Apply when Supabase is reachable: pnpm --filter @ko/db exec prisma db push
-- Or run this SQL in the Supabase SQL editor.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteTokenExpiry" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invitePending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canViewAllClients" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canViewAccountDetails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canViewAiSummaries" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "users_inviteToken_key" ON "users"("inviteToken");
