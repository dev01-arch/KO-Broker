# Backend ticket: Client Portal API (`/api/portal/*`)

**Project:** KO Broker Platform  
**Repo:** `KO-Broker` (`apps/web`)  
**Consumer:** Separate KO-Client frontend (calls `NEXT_PUBLIC_API_URL` → this API)  
**PRD ref:** PRD-13 (Client Portal Phase 2)  
**Related docs:** `Doc/KO-Client-Portal-Scaffold-Prompt.md`, `packages/types`

---

## Summary

Add **client-scoped** API routes under `/api/portal/*` in the existing Next.js broker app. The client portal is a separate frontend repo; it shares the same Postgres DB and must **not** use broker `/api/*` routes (those require broker Clerk org auth).

**Constraint:** Do **not** change behaviour of existing broker endpoints (`/api/messages`, `/api/cases`, etc.).

---

## Why

| Today | Problem |
|-------|---------|
| Broker APIs use `requireApiAuth()` → Clerk broker user + `orgId` | Clients cannot authenticate |
| `Client.portalEnabled` + `portalAccessToken` exist in schema | Never read/written in app code |
| `CLIENT_REPLY` + `INBOUND` already supported in `sendMessageForOrg` | No portal route exposes it |
| Client UI is being built in parallel | Blocked without portal APIs |

---

## Deliverables

### 1. Portal auth middleware

**File:** `apps/web/lib/api/require-portal-auth.ts`

Resolve a **portal session** on every `/api/portal/*` request (except public invite routes).

**Two auth modes:**

| Mode | When | Header |
|------|------|--------|
| Invite bootstrap | Before Clerk session | `X-Portal-Token: {portalAccessToken}` |
| Authenticated client | After OTP / Clerk sign-in | `Authorization: Bearer {clerk-jwt}` |

**Session shape (return type):**

```typescript
type PortalSession = {
  clientId: string;
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  portalAccessToken?: string; // during invite only
};
```

**Resolution rules:**

1. Lookup `Client` by `portalAccessToken` (invite) OR by Clerk `userId` / verified email (post-login).
2. Reject if `portalEnabled !== true`.
3. Reject if org lacks plan feature `client_portal` (`orgHasFeature(orgId, 'client_portal')`).
4. **Never** trust `clientId` or `orgId` from request body/query for authorization — always from session.
5. For case-scoped routes, verify `Case.clientId === session.clientId`.

**Suggested Clerk setup:** Separate Clerk application for clients (organisation-less). Link `Client.clerkId` column if needed (migration) OR match on email after OTP.

---

### 2. Route structure

```
apps/web/app/api/portal/
├── invite/
│   ├── validate/route.ts      POST
│   ├── send-otp/route.ts      POST
│   └── verify-otp/route.ts    POST
├── me/route.ts                GET
├── cases/
│   ├── route.ts               GET
│   └── [id]/
│       ├── route.ts           GET
│       ├── tasks/route.ts     GET
│       └── fact-find/route.ts PUT
├── messages/
│   ├── route.ts               GET, POST
│   └── [id]/route.ts          PATCH
└── documents/
    ├── route.ts               GET, POST
    └── [id]/route.ts          GET (optional)
```

Reuse existing helpers:

- `apiSuccess`, `apiError`, `apiFromZodError` from `lib/api/responses`
- `listMessagesForOrg`, `sendMessageForOrg`, `markMessageReadForOrg` from `lib/api/messages-data`
- `upsertFactFindForCase` from `lib/api/cases-data`
- `UpsertFactFindSchema`, `SendMessageSchema` from `@ko/types`

---

## API specification

**Base URL:** Same as broker app (e.g. `https://api.koplatform.co.uk` or `http://localhost:3001`)

**Response envelope (all routes):**

```json
{ "success": true, "data": { ... }, "meta": { "total": 0, "page": 1, "perPage": 25 } }
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

**Error codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `PLAN_LIMIT_EXCEEDED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`

---

### Phase 1 — P0 (unblocks client MVP)

#### `POST /api/portal/invite/validate`

**Auth:** `X-Portal-Token` only (no Clerk)

**Body:**

```json
{ "token": "string" }
```

**Logic:**

- Find `Client` where `portalAccessToken = token` AND `portalEnabled = true`
- Load primary open `Case` for client + assigned adviser summary
- Return 404 if invalid/expired token

**Response `data`:**

```json
{
  "client": {
    "id": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string"
  },
  "case": {
    "id": "string",
    "referenceNumber": "KOF-2025-0042",
    "type": "PURCHASE",
    "stage": "FACT_FIND"
  },
  "adviser": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null"
  }
}
```

---

#### `POST /api/portal/invite/send-otp`

**Auth:** `X-Portal-Token`

**Body:** `{ "token": "string" }`

**Logic:**

- Validate token → resolve client email
- Generate 6-digit OTP, store hashed with 10-min TTL (new table `PortalOtp` or Redis)
- Send via Resend (`lib/notifications/email.ts`)
- Rate limit: max 3 sends per token per hour

**Response `data`:**

```json
{ "sent": true, "emailMasked": "a***@example.com" }
```

---

#### `POST /api/portal/invite/verify-otp`

**Auth:** `X-Portal-Token`

**Body:**

```json
{ "token": "string", "code": "123456" }
```

**Logic:**

- Verify OTP
- Create or link Clerk client user (separate Clerk app)
- Return sign-in token / session ticket for client frontend

**Response `data`:**

```json
{
  "verified": true,
  "sessionToken": "string",
  "clientId": "string"
}
```

*(Exact Clerk response shape depends on integration — document in PR.)*

---

#### `GET /api/portal/me`

**Auth:** `Authorization: Bearer` (portal Clerk JWT)

**Response `data`:**

```json
{
  "client": {
    "id": "string",
    "referenceNumber": "KOC-2025-0012",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null"
  },
  "adviser": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null",
    "title": "Your Mortgage Advisor"
  },
  "primaryCase": {
    "id": "string",
    "referenceNumber": "string",
    "stage": "FACT_FIND",
    "type": "PURCHASE"
  }
}
```

---

#### `GET /api/portal/cases`

**Auth:** Portal session

**Query:** `page`, `perPage` (optional; client typically has 1 case)

**Logic:** `WHERE clientId = session.clientId` — read-only, no create/update

**Response:** `data: CaseSummary[]` — reuse `serializeCase` from `lib/api/cases.ts` (subset fields OK)

---

#### `GET /api/portal/cases/:id`

**Auth:** Portal session + case ownership check

**Response `data`:** Case detail including `factFind` (same shape as broker `GET /api/cases/:id` but strip adviser-only fields like internal notes if any)

---

#### `PUT /api/portal/cases/:id/fact-find`

**Auth:** Portal session + case ownership

**Body:** `UpsertFactFindSchema` from `@ko/types`

```json
{
  "personalDetails": { },
  "employmentDetails": { },
  "incomeDetails": { },
  "expenditureDetails": { },
  "propertyDetails": { },
  "existingMortgages": { },
  "clientPreferences": { },
  "markComplete": false
}
```

**Logic:** Delegate to `upsertFactFindForCase(orgId, caseId, body)` — same as broker `PUT /api/cases/:id/fact-find` but scoped to client's case only.

**Note:** Client must not set `markComplete: true` until all required sections valid (optional server-side validation).

---

#### `GET /api/portal/messages`

**Auth:** Portal session

**Query:**

| Param | Type | Notes |
|-------|------|-------|
| `caseId` | string | Optional; must belong to client |
| `page` | number | Default 1 |
| `perPage` | number | Default 50, max 100 |

**Logic:**

```sql
WHERE orgId = session.orgId
  AND clientId = session.clientId
  AND channel = 'IN_APP'
  [AND caseId = :caseId]
ORDER BY createdAt ASC
```

**Response:** `data: MessageRecord[]` — same shape as broker (`lib/api/client.ts`)

---

#### `POST /api/portal/messages`

**Auth:** Portal session

**Body:**

```json
{
  "body": "string (required, min 1)",
  "caseId": "string (required)"
}
```

**Server sets (do not accept from client):**

```typescript
{
  channel: 'IN_APP',
  sourceType: 'CLIENT_REPLY',  // → direction INBOUND via sendMessageForOrg
  clientId: session.clientId,
  orgId: session.orgId,
}
```

**Logic:** `sendMessageForOrg(orgId, { ... })` — **do not** trigger outbound email/SMS for client replies.

**Response:** `201` + `data: MessageRecord`

---

### Phase 2 — P1 (complete client features)

#### `GET /api/portal/cases/:id/tasks`

Return checklist for Overview “Your next steps”:

```json
{
  "tasks": [
    { "id": "string", "label": "Upload your last 3 months' payslips", "completed": false, "href": "/application" },
    { "id": "string", "label": "Upload bank statement", "completed": true }
  ]
}
```

Derive from case stage + missing documents + fact-find completion (business rules TBD).

---

#### `PATCH /api/portal/messages/:id`

**Body:** `{ "isRead": true }`

**Logic:** `markMessageReadForOrg` — only if message `clientId === session.clientId` AND `direction === 'OUTBOUND'` (client marks adviser messages read).

---

#### `GET /api/portal/documents`

**Query:** `caseId`, `page`, `perPage`

**Logic:** List documents where `clientId = session.clientId` (and optional `caseId`). Reuse documents data layer.

---

#### `POST /api/portal/documents`

**Body:** `multipart/form-data` — same as broker `POST /api/documents` but:

- `clientId` / `caseId` from session (not body)
- Allowed types: `ID`, `INCOME`, `FINANCIAL`, `OTHER` only (no `COMPLIANCE`, `LENDER`)

Reuse R2 upload path from broker documents route.

---

## Broker-side prep (same ticket or follow-up)

| Task | Notes |
|------|-------|
| Generate `portalAccessToken` on invite | `crypto.randomUUID()` or secure random string; unique index exists |
| Broker UI: “Send portal invite” | Sets `portalEnabled: true`, emails link `https://client…/invite?token=` |
| Clerk client application | Separate from broker Clerk; env vars documented |
| CORS (if client on different origin) | Allow client Vercel domain on portal routes |

---

## Security checklist

- [ ] Portal routes never accept broker Clerk sessions
- [ ] `clientId` / `orgId` always from `requirePortalAuth()`, never from request body
- [ ] Case routes verify `case.clientId === session.clientId`
- [ ] `portalEnabled` checked on every request
- [ ] `client_portal` plan feature enforced
- [ ] OTP hashed at rest; short TTL; rate limited
- [ ] Client cannot read other clients’ messages/documents
- [ ] Client cannot POST with `sourceType` other than `CLIENT_REPLY`
- [ ] Client cannot use `EMAIL`/`SMS` channel on POST (in-app only)

---

## Acceptance criteria

### Auth & invite

- [ ] Valid `portalAccessToken` returns client + case + adviser on validate
- [ ] Invalid token returns `404 NOT_FOUND`
- [ ] OTP flow: send → verify → client can call authenticated routes
- [ ] Disabled portal (`portalEnabled: false`) returns `403 FORBIDDEN`

### Cases & fact-find

- [ ] Client can `GET` only their own case(s)
- [ ] `PUT fact-find` partial save works; refresh preserves data
- [ ] Broker `PUT /api/cases/:id/fact-find` still works unchanged for advisers

### Messages

- [ ] Client `GET /api/portal/messages` returns in-app thread for their case
- [ ] Client `POST` creates message with `direction: INBOUND`, `sourceType: CLIENT_REPLY`
- [ ] Same message appears on broker `GET /api/messages?clientId=…` as **Inbound**
- [ ] Broker `POST /api/messages` unchanged; outbound still works

### Regression

- [ ] All existing broker API tests / manual flows pass
- [ ] `pnpm typecheck` and `pnpm build` pass
- [ ] No changes to broker dashboard auth or `requireApiAuth` behaviour

---

## Test plan

1. Seed client with `portalEnabled: true`, `portalAccessToken`, linked case
2. `POST invite/validate` with token → 200
3. `POST invite/send-otp` → email received
4. `POST invite/verify-otp` → Clerk session
5. `GET /api/portal/me` with client JWT → profile
6. `PUT /api/portal/cases/:id/fact-find` with partial `personalDetails` → saved
7. Broker sends in-app message → client `GET /api/portal/messages` shows it
8. Client `POST /api/portal/messages` → broker hub shows inbound reply
9. Attempt `GET /api/portal/cases/{otherClientCaseId}` → `403` or `404`

---

## Suggested implementation order

1. `requirePortalAuth` + `GET /api/portal/me`
2. Invite flow (validate → send-otp → verify-otp)
3. `GET /api/portal/cases/:id` + `PUT fact-find`
4. `GET/POST /api/portal/messages`
5. Tasks + documents (Phase 2)

**Estimated effort:** 2–3 days (Phase 1), +1 day (Phase 2)

---

## Out of scope

- KO-Client frontend UI (separate repo)
- Changes to broker CRM message UI
- Client self-registration without invite
- Web push notifications

---

## References in codebase

| File | Use |
|------|-----|
| `apps/web/lib/api/require-api-auth.ts` | Pattern to mirror (portal variant) |
| `apps/web/lib/api/messages-data.ts` | `sendMessageForOrg`, `listMessagesForOrg` |
| `apps/web/app/api/messages/route.ts` | Broker reference implementation |
| `apps/web/app/api/cases/[id]/fact-find/route.ts` | Fact-find reference |
| `packages/types/src/index.ts` | Zod schemas + envelope types |
| `packages/db/prisma/schema.prisma` | `Client.portalEnabled`, `Client.portalAccessToken`, `Message` |

---

*Copy into Linear/Jira as: **“Implement Client Portal API (`/api/portal/*`)”***
