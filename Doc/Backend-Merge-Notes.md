# Backend merge notes (frontend ↔ backend API)

**Purpose:** Document what changed when adopting the backend engineer’s API layer into this repo, so a pull/merge stays reviewable and conflicts stay small.

**Source of backend code:** `KO-Broker-test` (backend endpoints + `createHandler` stack)  
**Date:** 2026-07-19

---

## How to read this when reviewing a PR

1. Prefer **backend’s route structure** (`createHandler` / `createParamHandler`).
2. Look for blocks marked:

```ts
// === FRONTEND ADDITION: … ===
// …
// === END FRONTEND ADDITION ===
```

Those are the only intentional frontend deltas on top of backend code.

3. **New files that only exist on frontend** (no backend equivalent) should merge cleanly as additions.

---

## Backend code taken largely as-written

### Core infrastructure

| Path | Notes |
|------|--------|
| `apps/web/lib/api/handler.ts` | Backend `createHandler` / `createParamHandler` |
| `apps/web/lib/api/spec.ts` | API docs spec (backend) |
| `apps/web/lib/auth/index.ts` | Backend auth helpers + visibility masking |
| `apps/web/lib/auth/portalAuth.ts` | Backend portal JWT / PBKDF2 helpers |
| `apps/web/lib/db/index.ts` | Backend prisma re-exports |
| `apps/web/lib/compliance/*` | Backend audit / workflow / vulnerability |

### Routes replaced with backend implementations

Most shared `/api/**/route.ts` files now use backend `createHandler` style, including:

- Clients, cases, messages, documents, compliance advance
- Portal login/setup/logout/verify-token/fact-find/documents/messages/invite
- Settings advisers (+ new `[id]` + resend-invite)
- Billing checkout, webhooks, AI generate/regenerate
- Health

### Routes added from backend (new)

| Path | Purpose |
|------|---------|
| `apps/web/app/api/advisers/accept-invite/route.ts` | Accept adviser invite token |
| `apps/web/app/api/settings/advisers/[id]/route.ts` | PATCH/DELETE adviser |
| `apps/web/app/api/settings/advisers/[id]/resend-invite/route.ts` | Resend invite |

### Schema (additive)

On `User` (keeps existing `OrganisationMember` model):

- `inviteToken`, `inviteTokenExpiry`, `invitePending`
- `canViewAllClients`, `canViewAccountDetails`, `canViewAiSummaries`

**Migration required** after pull: `pnpm --filter @ko/db exec prisma db push` (or run `packages/db/prisma/manual-adviser-invite-columns.sql` in Supabase).

## Messages route note

`GET/POST /api/messages` uses `requireApiAuth` (same as dashboard bootstrap), not `createHandler`, so the inbox poll does not 503 inside handler-factory auth when Supabase blips. Backend `createHandler` shape remains on other shared routes.

---

## Frontend-only additions (keep these; do not revert)

These routes/features have **no backend equivalent** and must remain:

| Area | Paths |
|------|--------|
| Dashboard bootstrap | `api/dashboard/bootstrap` |
| Billing portal / subscription | `api/billing/portal`, `api/billing/subscription` |
| Messaging settings | `api/settings/messaging`, `api/settings/org` |
| Message email digests | `api/cron/message-email-digests`, `lib/notifications/message-email-digest.ts` |
| Client notification prefs | `api/portal/notification-settings`, `lib/api/client-notification-prefs.ts` |
| Portal extras | `api/portal/me`, `api/portal/cases/[id]`, `api/portal/cases/[id]/fact-find` |
| AI extras | `api/ai/extract-fact-find`, `api/ai/reports` (list) |
| Incremental products CRUD | `api/cases/[id]/products` (GET + single create) + `.../products/[productId]` |

> **Products note:** Backend’s bulk `SaveProductsSchema` / replace-all POST is in `@ko/types` as `SaveProductsSchema`. The live collection route keeps **incremental** CRUD used by the dashboard. If you need bulk sync, add `PUT` alongside — do not replace GET/POST incremental behaviour.

---

## Marked patches on backend files (what to accept in merge)

### Auth / handler / proxy

| File | Frontend patch |
|------|----------------|
| `lib/auth/index.ts` | Clerk Bearer fallback when `x-user-id` missing; auto-provision user/org; `getOrgId()` falls back to `User.orgId` |
| `lib/api/handler.ts` | Plan gates use soft `orgHasFeature` (`KO_ENFORCE_PLAN_LIMITS`) |
| `proxy.ts` | Injects `x-user-id` / `x-org-id` for `createHandler` **and** keeps CORS helpers |
| `lib/auth/portalAuth.ts` | Accepts both backend JWT and frontend `portal-session` cookies |

### Feature-critical route patches

| File | Why |
|------|-----|
| `api/messages/route.ts` | Uses `sendMessageForOrg` / digest scheduling (not immediate email) |
| `api/messages/[id]/route.ts` | Cancels digests when inbox caught up |
| `api/portal/messages/route.ts` | Uses `portal-data` send/list (adviser digests) |
| `api/portal/login` / `setup` / `logout` | `portalPasswordHash` field; scrypt + env-aware cookies |
| `api/portal/invite/route.ts` | Uses `inviteClientToPortal` (compatible email API) |
| `api/clients/route.ts` | Company clients, filters, `assignedMemberId` via `clients-data` |
| `api/clients/[id]/route.ts` | Includes `assignedMember`; ADMIN bypass on visibility edit |
| `api/settings/advisers/route.ts` | Dual-writes `OrganisationMember` (dashboard assignment ids); GET not admin-only |
| `api/billing/checkout/route.ts` | `stripe-checkout` helpers, success/cancel URLs, stale-customer retry |
| `lib/notifications/email.ts` | Added `sendAdviserInvite` (backend function) without removing digest templates |

### Types (`packages/types`)

Aliases / additions for backend imports (kept existing frontend schemas):

- `CreateMessageSchema` → alias of `SendMessageSchema`
- `PatchMessageSchema` → alias of `MarkMessageReadSchema`
- `AdvanceComplianceStageSchema`, portal schemas, `InviteAdviserSchema`, `UpdateAdviserVisibilitySchema`, `AcceptAdviserInviteSchema`, `SaveProductsSchema`, `CreateDocumentSchema`, `UpdateClientSchema`

---

## What the backend engineer should do on pull

1. **Accept** frontend addition blocks rather than resolving by taking “ours” wholesale on patched files.
2. Run **Prisma migrate** for the new `User` invite/visibility columns.
3. Do **not** delete frontend-only routes listed above.
4. Do **not** replace incremental products CRUD with bulk-only POST without a product UI change.
5. Optional cleanup later: delete `.backend-merge-backup/` (local reference copies of pre-merge routes).

---

## Intentional dual systems (temporary, documented)

| Concern | Backend | Frontend compatibility |
|---------|---------|------------------------|
| Portal passwords | PBKDF2 in `portalAuth` | Login accepts scrypt **or** PBKDF2; new setups use scrypt |
| Portal session cookie | JWT via `JWT_SECRET` | Login/setup issue `portal-session` tokens; `getPortalClient` accepts both |
| Advisers | `User` + invite tokens | Also `OrganisationMember` for `assignedMemberId` |
| Plan limits | Hard in original handler | Soft unless `KO_ENFORCE_PLAN_LIMITS=true` |

---

## Backup

Pre-merge copies of overwritten routes live under:

`.backend-merge-backup/`

(for local reference only — safe to delete after review)
