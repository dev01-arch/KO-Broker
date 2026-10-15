# API performance

Every dashboard request felt slow because the same setup work ran before the actual query. The data each screen shows is unchanged. These changes only remove repeated waiting.

## Why calls were slow

1. **Clerk token on every call.** The browser called `getToken()` before each request. A page that fires several calls waited on Clerk once per call, even though the session JWT is valid for about a minute.

2. **Auth ran twice on the server.** Middleware already verified the session and set `x-user-id`. Many routes then called Clerk again inside `requireApiAuth()`, then called `getCurrentUser()`, which queried the user row and the visibility flags as two separate database round-trips. `getOrgId()` could load that user again.

3. **Database pool of 3.** The Prisma client added `connection_limit=3`. Dashboard bootstrap runs org, clients, cases, advisers, and two counts together. Extra connections waited in a queue, so unrelated API calls stalled behind each other. `pool_timeout` was 60 seconds, so a queued call could sit for a long time.

4. **Case details were warmed one-by-one after a 2.5 second pause.** Opening the dashboard delayed case, timeline, and message prefetches instead of loading them together once the browser was idle.

5. **Compliance and unread messages were fetched only when that part of the screen mounted.** The first visit compiled and loaded them while the user was waiting. They are now warmed in the background after bootstrap, into the same React Query keys the screens already use.

React Query already keeps list data for 5 minutes (`staleTime` in `components/providers.tsx`). Repeat visits were slow because each new request still paid the auth and pool cost above, and because some screens never shared a cached response.

## What changed

| Change | Effect |
| --- | --- |
| Session JWT cache (`lib/api/session-token.ts`) | Parallel calls share one `getToken()`. Later calls reuse the token until 15 seconds before it expires. A 401 clears it so the next call signs in again. |
| One user lookup (`lib/auth/index.ts`, `lib/api/require-api-auth.ts`) | Middleware `x-user-id` is used first. User row and visibility flags load in one query. The same request reuses that result. The process keeps it for 30 seconds. |
| Cache drop on user changes | Adviser updates, deletes, invite accept, org link, and Clerk webhooks clear that user so role and visibility stay correct. |
| Pool of 10, 20s pool timeout (`lib/db/index.ts`) | Bootstrap's parallel queries no longer queue on three connections. In development the client is recreated when this URL changes. |
| Identical in-flight GETs (`lib/api/client.ts`) | Two callers of the same GET share one response. |
| Idle parallel case warm (`live-demo-page.tsx`) | Recent case detail, timeline, and messages load together after idle, not after a 2.5s sequential queue. |
| Background warm (`dashboard-data-prefetch.tsx`) | After bootstrap, idle time fills settings, compliance overview, and the unread-message query the badge already uses. |

Restart the dev server once so Prisma picks up the new pool size if it was already running.

## Frontend call sites

All authenticated browser calls go through `lib/api/client.ts` (`apiFetch` / `apiFetchBlob`) except the adviser-invite page, which posts to `/api/advisers/accept-invite`.

Hooks (React Query). Each `queryFn` / `mutationFn` now takes the shared session token via `requireAuthToken` or `getCachedSessionToken`.

| Hook file | Calls |
| --- | --- |
| `hooks/use-dashboard-bootstrap.ts` | `GET /api/dashboard/bootstrap` |
| `hooks/use-clients.ts` | `GET/POST /api/clients`, `GET/PATCH /api/clients/:id` |
| `hooks/use-cases.ts` | `GET/POST /api/cases`, `GET/PATCH /api/cases/:id`, fact-find, products, timeline |
| `hooks/use-documents.ts` | `GET/POST /api/documents`, `DELETE /api/documents/:id` |
| `hooks/use-messages.ts` | `GET/POST /api/messages`, `PATCH /api/messages/:id` (unread poll every 12s) |
| `hooks/use-compliance.ts` | `GET /api/compliance`, `GET /api/compliance/cases/:id`, advance, complete item |
| `hooks/use-ai-reports.ts` | list, generate, regenerate, approve, export PDF, extract fact-find |
| `hooks/use-settings.ts` | org is separate; integrations, messaging, advisers CRUD, resend invite |
| `hooks/use-org.ts` | `GET /api/settings/org` |
| `hooks/use-billing.ts` | checkout, subscription, portal |
| `hooks/use-intelligence.ts` | overview, current rates, case preview, snapshots, copy to notes |
| `hooks/use-portal-invite.ts` | `POST /api/portal/invite` |
| `hooks/use-system.ts` | `GET /api/health` |

Other UI:

| File | Calls |
| --- | --- |
| `components/dashboard/dashboard-data-prefetch.tsx` | bootstrap, then idle: integrations, messaging, advisers, compliance overview, unread messages |
| `components/marketing/live-demo-page.tsx` | cases, clients, properties, fact-find, products, notes, timeline, messages, documents, compliance, lenders — same endpoints as the hooks, through `*Api` helpers |
| `components/dashboard/clients/edit-client-modal.tsx` | client get/update, properties |
| `components/dashboard/clients/import-clients-modal.tsx` | `POST /api/clients/import` |
| `components/auth/adviser-invite-page.tsx` | `POST /api/advisers/accept-invite` |

`components/providers.tsx` sets `staleTime` to 5 minutes and turns off refetch-on-focus, so navigating around the dashboard reuses data. Mutations still update the caches in `lib/api/query-cache.ts`.

## API routes

Authenticated product routes all pay the shared auth path above. Cron and webhooks do not use the dashboard session.

| Route | Used for |
| --- | --- |
| `GET /api/dashboard/bootstrap` | Home: org, clients, cases, advisers |
| `GET /api/dashboard/pipeline` | Overview kanban cases only, so the board does not wait for the full bootstrap |
| `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id` | Client list and record |
| `GET/POST /api/clients/:id/properties` | Properties |
| `POST /api/clients/import`, `GET /api/clients/import/template` | CSV import |
| `GET/POST /api/cases`, `GET/PATCH /api/cases/:id` | Case list and record |
| `PUT /api/cases/:id/fact-find` | Fact-find save |
| `GET/POST /api/cases/:id/products`, `PATCH/DELETE .../products/:productId` | Products considered |
| `GET/POST /api/cases/:id/notes` | Notes |
| `GET/POST /api/cases/:id/info-requests` | Document requests |
| `GET /api/cases/:id/timeline` | Activity |
| `GET /api/lenders` | Lender search |
| `GET/POST /api/admin/lenders`, `GET /api/admin/lenders/other-usage` | Admin directory |
| `GET/POST /api/documents`, `GET/DELETE /api/documents/:id` | Files |
| `GET/POST /api/messages`, `PATCH /api/messages/:id` | Inbox |
| `GET /api/compliance`, `GET /api/compliance/cases/:id` | Checklist |
| `POST /api/compliance/advance`, `POST /api/compliance/items` | Stage and item updates |
| `GET /api/ai/reports`, `POST /api/ai/generate-report`, `POST /api/ai/regenerate-section` | Suitability reports |
| `POST /api/ai/reports/:id/approve`, `POST .../export-pdf` | Approve and PDF |
| `POST /api/ai/extract-fact-find` | Document extraction |
| `GET /api/intelligence/overview`, `GET /api/intelligence/rates/current` | Market intelligence |
| `GET /api/intelligence/cases/:caseId/preview` | Case preview |
| `GET/POST /api/intelligence/snapshots`, `GET /api/intelligence/snapshots/:id` | Snapshots |
| `POST /api/intelligence/snapshots/:id/copy-to-notes` | Copy into notes |
| `GET /api/settings/org` | Plan and role |
| `GET/PUT /api/settings/integrations` | Equifax / Twilio |
| `GET/PUT /api/settings/messaging` | Channel toggles |
| `GET/POST /api/settings/advisers`, `PATCH/DELETE /api/settings/advisers/:id` | Team |
| `POST /api/settings/advisers/:id/resend-invite` | Invite email |
| `POST /api/advisers/accept-invite` | Invite acceptance |
| `POST /api/billing/checkout`, `GET /api/billing/subscription`, `POST /api/billing/portal` | Stripe |
| `POST /api/portal/invite` | Client portal invite |
| Portal session routes under `/api/portal/*` | Client portal (cookie session, not the adviser dashboard token) |
| `GET /api/health`, `GET /api/docs` | Health and API docs |
| `POST /api/webhooks/clerk`, `stripe`, `email` | Inbound webhooks |
| `GET/POST /api/cron/*` | Scheduled jobs |

AI generation, PDF export, fact-find extraction, and intelligence snapshots still take as long as the model or external data source needs. Those are not list loads. Their auth setup is the same faster path as everything else.
