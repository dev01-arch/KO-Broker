# KO Client Portal — New Repository Scaffold Prompt

> **Purpose:** Copy this entire document into a **new Cursor instance** (empty or freshly cloned repo) to scaffold **KO Client Platform** — the client-facing app that pairs with the existing **KO-Broker** monorepo.
>
> **Critical constraint:** This is a **separate repository**. Do **not** modify, import from, or break the KO-Broker codebase. The broker repo already has Phase 2 placeholders (`portalEnabled`, `portalAccessToken`, `/portal` 404). All client UI and client-scoped API work lives here.

---

## Cursor system prompt (paste this first)

```
You are scaffolding KO Client Platform — a standalone client-facing Next.js app for UK mortgage clients invited by their broker on KO Broker Platform.

Sibling repo: KO-Broker (broker CRM + API). This repo mirrors its monorepo structure, design tokens, API envelope, and TypeScript conventions so both apps stay aligned.

Constraints:
- NO marketing/landing page. Root redirects to dashboard or invite flow.
- NO changes to KO-Broker. Consume shared types via @ko/types (git submodule or copied package).
- Mobile-first responsive UI.
- Use mock API layer until broker exposes /api/portal/* endpoints.
- Match design: brand teal (#0F6E56), Syne headings, DM Sans body, surface (#F7FBF9) backgrounds.

Build the repo structure, core routes, auth/invite flow shell, dashboard shell, and placeholder pages matching the attached UI references. Use TypeScript strict, Tailwind v4, React Query, Zod, Clerk (client-only identity).
```

---

## 1. Repository identity

| Field | Value |
|-------|-------|
| **Repo name** | `ko-client` (or `KO-Client`) |
| **Package name** | `ko-client-platform` |
| **App package** | `@ko/client` |
| **Description** | Client portal for KO Broker Platform — invited clients view case progress, complete tasks, message their adviser, and fill fact-find forms |
| **Deploy target** | Vercel (separate project from broker) |
| **Dev port** | `3002` (broker uses `3001`) |

---

## 2. Monorepo structure (mirror KO-Broker)

Create the same pnpm workspace layout so engineers can move between repos without friction.

```
ko-client/
├── package.json                    # Root scripts (pnpm workspaces)
├── pnpm-workspace.yaml             # apps/*, packages/*, tooling/*
├── tsconfig.json                   # Root path aliases for @ko/*
├── .env.example
├── .gitignore
├── README.md
├── docker/
│   └── docker-compose.yml          # Optional: local postgres only if client BFF added later
├── .github/workflows/
│   └── ci.yml                      # install → typecheck → lint → build
├── Doc/
│   └── API-CONTRACT.md             # Portal API contract (broker will implement)
├── context/
│   ├── project-overview.md
│   └── ui-context.md               # Copy design tokens from KO-Broker
├── apps/
│   └── client/                     # @ko/client — sole Next.js app
│       ├── app/
│       │   ├── layout.tsx          # Root layout, fonts, providers
│       │   ├── page.tsx            # Redirect → /invite or /dashboard
│       │   ├── (auth)/
│       │   │   ├── invite/
│       │   │   │   └── page.tsx    # Welcome + OTP modal (entry from broker email link)
│       │   │   └── verify/
│       │   │       └── page.tsx    # OTP code entry
│       │   └── (dashboard)/
│       │       ├── layout.tsx      # Sidebar shell + auth guard
│       │       ├── overview/
│       │       │   └── page.tsx    # Default dashboard home
│       │       ├── application/
│       │       │   └── page.tsx    # My Application (fact-find wizard)
│       │       ├── messages/
│       │       │   └── page.tsx
│       │       └── tools/
│       │           └── page.tsx    # Mortgage Tools (read-only calculators later)
│       ├── components/
│       │   ├── ui/                 # shadcn/ui primitives
│       │   ├── auth/
│       │   │   ├── invite-welcome-modal.tsx
│       │   │   ├── otp-verification-form.tsx
│       │   │   └── client-auth-guard.tsx
│       │   └── dashboard/
│       │       ├── client-dashboard-shell.tsx
│       │       ├── client-dashboard-nav.tsx
│       │       ├── application-progress-stepper.tsx
│       │       ├── next-steps-card.tsx
│       │       ├── adviser-contact-card.tsx
│       │       └── api-error-state.tsx
│       ├── hooks/
│       │   ├── use-portal-session.ts
│       │   ├── use-portal-case.ts
│       │   ├── use-portal-tasks.ts
│       │   └── use-portal-messages.ts
│       ├── lib/
│       │   ├── api/
│       │   │   ├── client.ts       # Typed fetch + envelope parsing
│       │   │   ├── portal-data.ts  # Mock data layer (swap for real API)
│       │   │   ├── responses.ts
│       │   │   └── errors.ts
│       │   └── utils.ts            # cn() helper
│       ├── proxy.ts                # Clerk middleware (match broker pattern)
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── types/                      # @ko/types — SHARED CONTRACT with broker
│   │   └── src/index.ts            # Submodule or sync from KO-Broker/packages/types
│   └── utils/                      # @ko/utils — optional, copy from broker
│       └── src/index.ts
└── tooling/
    └── eslint-config/
```

**Do not create** `(marketing)/` route group. **Do not create** broker CRM routes (`/dashboard/clients`, `/dashboard/cases`, etc.).

---

## 3. Tech stack (must match broker)

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm 10 workspaces |
| Framework | Next.js 16 (App Router, Turbopack) |
| React | 19 |
| Language | TypeScript strict |
| Styling | Tailwind CSS v4 |
| UI | shadcn/ui + Radix + Lucide icons |
| Fonts | Syne (headings), DM Sans (body) |
| Data fetching | TanStack React Query v5 |
| Validation | Zod (from `@ko/types`) |
| Auth | Clerk — **client identity only** (no organisation) |
| Deploy | Vercel |

Root `package.json` scripts (mirror broker):

```json
{
  "scripts": {
    "dev": "pnpm --filter @ko/client dev",
    "build": "pnpm --filter @ko/client build",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,css}\""
  }
}
```

`apps/client/package.json` dev script: `"dev": "next dev --turbopack -p 3002"`

---

## 4. Shared contract with KO-Broker

### 4.1 `@ko/types` — keep in sync

The broker repo publishes Zod schemas and API envelope types in `packages/types/src/index.ts`. The client repo **must** use the same:

- `ApiSuccessResponse<T>`, `ApiErrorResponse`, `ApiResponse<T>`
- Error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, etc.
- Enums: `CaseStage`, `CaseType`, `EmploymentStatus`, `MessageDirection`, `DocumentType`
- Request schemas: `SendMessageSchema`, `UpsertFactFindSchema` (when client fills fact-find)

**Sync strategy (pick one):**

1. **Git submodule:** `packages/types` → `KO-Broker/packages/types`
2. **Private npm package:** publish `@ko/types` from broker CI
3. **Manual copy:** document version pin in `Doc/API-CONTRACT.md`

### 4.2 Broker data model (read-only context)

The client app displays data the broker already stores:

**Client** (`portalEnabled`, `portalAccessToken`, `firstName`, `lastName`, `email`, …)

**Case** (`stage`, `type`, `referenceNumber`, `propertyValue`, `loanAmount`, …)

**FactFind** (JSON sections: personal, employment, income, …)

**Message** (`direction`: INBOUND | OUTBOUND, `channel`, `body`, …)

**Document** (`documentType`, `storageUrl`, …)

### 4.3 Portal API contract (broker will implement — client mocks until ready)

Document these endpoints in `Doc/API-CONTRACT.md`. Client app calls `NEXT_PUBLIC_API_URL` (broker API origin).

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/portal/invite/validate` | Validate `?token=` from invite link; return client + case + adviser summary |
| `POST` | `/api/portal/invite/send-otp` | Send OTP to client email |
| `POST` | `/api/portal/invite/verify-otp` | Verify OTP; return session / Clerk sign-in token |
| `GET` | `/api/portal/me` | Authenticated client profile |
| `GET` | `/api/portal/cases` | Client's case(s) — read-only |
| `GET` | `/api/portal/cases/:id` | Case detail + factFind + adviser |
| `GET` | `/api/portal/cases/:id/tasks` | Pending actions checklist |
| `PUT` | `/api/portal/cases/:id/fact-find` | Client submits fact-find sections |
| `GET` | `/api/portal/messages` | Message thread |
| `POST` | `/api/portal/messages` | Client reply (`direction: INBOUND`, `sourceType: CLIENT_REPLY`) |
| `GET` | `/api/portal/documents` | List documents |
| `POST` | `/api/portal/documents` | Upload document (multipart) |

**Auth header:** `Authorization: Bearer <clerk-jwt>` after OTP verification, OR `X-Portal-Token: <portalAccessToken>` during invite bootstrap.

**Response envelope (always):**

```typescript
// Success
{ success: true, data: T, meta?: { total?, page?, perPage? } }

// Error
{ success: false, error: { code, message, fields?, details? } }
```

### 4.4 Broker invite URL pattern

Broker will email clients a link like:

```
https://client.koplatform.co.uk/invite?token={portalAccessToken}
```

Broker-side fields already in schema: `Client.portalEnabled`, `Client.portalAccessToken` (not yet wired in broker UI — **out of scope for this repo**).

---

## 5. User flows

### 5.1 Invite → OTP → Dashboard

```
Broker enables portal + sends invite email (broker repo, future)
        ↓
Client opens /invite?token=...
        ↓
Welcome modal (first paint)
  - Illustration + confetti
  - "Welcome to KO Brokers"
  - "Hi {clientName}, you have been invited by {adviserName} to complete
     a fact find form to aid case {caseReference}."
  - "Before you begin, an OTP will be sent to {clientEmail}."
  - CTA: "Send Verification"
        ↓
POST /api/portal/invite/send-otp
        ↓
OTP entry screen (/verify or inline step)
        ↓
POST /api/portal/invite/verify-otp → Clerk session
        ↓
Redirect to /overview (dashboard home)
```

**Until broker APIs exist:** implement `lib/api/portal-data.ts` with in-memory mock returning Alex / James Davies / sample case `KOF-2025-0001`.

### 5.2 Returning client

```
/ → check Clerk session
  - authenticated → /overview
  - unauthenticated → show error / "request new invite link"
```

No self-sign-up. No landing page.

---

## 6. Dashboard UI specification

Reference mockups: **Overview** (sidebar + progress + cards) and **Invite welcome modal**.

### 6.1 Shell (`client-dashboard-shell.tsx`)

**Full sidebar spec:** see **[KO-Client-Sidebar-Design.md](./KO-Client-Sidebar-Design.md)** — extracted from the live demo embedded nav (`live-demo-page.tsx`).

Summary:

- **Width:** `254px` on desktop (`lg:w-[254px]`), sticky full-height column
- **Logo:** `Building2` in `bg-brand-teal` rounded box + **KO Platform** wordmark (`text-brand-teal`, Syne bold)
- **Nav pills:** rounded `32px` capsules with nested icon chip (`34px` circle, 24px icon)
- **Active state:** `border-[#00B8D9] bg-[#E9FCFF]` — cyan highlight (not teal-50)
- **Inactive:** white pill, grey icon chip `rgba(242,242,242,0.95)`, hover `#fafafa`
- **Nav items** (no section labels, no plan footer):

  | Label | Route | Icon |
  |-------|-------|------|
  | Overview | `/overview` | `dashboard_customize.svg` |
  | My Application | `/application` | Lucide `Briefcase` |
  | Messages | `/messages` | `chat.svg` |
  | Mortgage Tools | `/tools` | Lucide `Calculator` |

- **Main area:** `surface` (`#F7FBF9`) with optional `Dash-bg.png` gradient
- **No top marketing header**

### 6.2 Overview page (`/overview`)

**Header row:**
- Date line: `THURSDAY, 18 JUNE` (uppercase, grey, small)
- Greeting: `Good morning, {firstName}.` (large, bold, Syne)

**Application Progress** (`application-progress-stepper.tsx`):

Horizontal stepper — map internal `CaseStage` to client-friendly labels:

| Step | Client label | Typical stage mapping |
|------|--------------|----------------------|
| 1 | Information Gathering | `FACT_FIND` |
| 2 | Broker Review | `RESEARCH` |
| 3 | KIP Submitted | `DIP` |
| 4 | Mortgage Offer | `OFFER` |

States: `completed` (green check), `in_progress` (green ring + dot + "In progress" label), `pending` (grey ring).

**Two-column card row (responsive stack on mobile):**

**Left — Your Next Steps** (`next-steps-card.tsx`):
- Blue info icon + title "Your next steps"
- Subtitle: "Complete these to move your application forward."
- Checklist items with circle checkboxes:
  - Unchecked: empty grey circle
  - Checked: blue circle + white check + strikethrough text
- Full-width green CTA: **Go to My Application →** → links to `/application`

**Right — Adviser Contact** (`adviser-contact-card.tsx`):
- Gold avatar with initials (e.g. "JD")
- Name + "Your Mortgage Advisor"
- Phone + email with icons
- Outlined button: **Send a message** → `/messages`

### 6.3 My Application page (`/application`)

**Full fact-find spec:** see **[KO-Client-FactFind-Design.md](./KO-Client-FactFind-Design.md)** — ported from live demo wizard (`live-demo-prototype-v2a.html`, `FF_SG` / `FF_Q`).

Summary:

- **Layout:** Inline wizard inside dashboard shell (sidebar stays visible) — not full-screen overlay
- **Top:** 3px green progress bar + top bar (logo, save status, `3 / 22` counter)
- **Section strip (8 pills):** Personal · Employment · Income · Commitments · Property · Adverse Credit · Goals · Vulnerability
- **Card flow:** One question per screen, max width `672px`, slide animations
- **Bottom:** Dot pager + Back / Continue actions
- **Auto-save:** 2s debounce → `PUT /api/portal/cases/:id/fact-find`
- **Client copy:** First-person ("your name") — omit adviser-only fields
- **Invite overlay:** Welcome/OTP modal dims this page on first visit — full spec: **[KO-Client-FactFind-Modals-And-States.md](./KO-Client-FactFind-Modals-And-States.md)** (upload, errors, missing fields, completion).

**Question types to implement:** pills, yes/no, currency, address groups, repeatable credit cards/loans, LTV panel, vulnerability questionnaire (see design doc §5).

**Invite modal overlay:** On first visit after invite (before OTP), show welcome modal **over** dimmed application shell (as per mockup).

### 6.4 Messages page (`/messages`)

Simpler than broker hub:
- Single thread with assigned adviser
- Compose box for client replies
- Mobile: full-width thread

### 6.5 Mortgage Tools page (`/tools`)

**Full spec:** see **[KO-Client-Calculators-Design.md](./KO-Client-Calculators-Design.md)** — ported from `MortgageCalculators.tsx` + PRD-11.

Summary:

- **No backend API** — pure client-side math (unlike messages/fact-find)
- **8 calculators:** Affordability, Monthly Payment, Stamp Duty, LTV, ERC, Rental Yield, Remortgage Saving, Debt Consolidation
- **Layout:** 2×4 card grid + active panel below (avoid inner sidebar — client already has dashboard nav)
- **Reuse:** Copy `apps/web/components/marketing/demo-calculator/MortgageCalculators.tsx` from KO-Broker
- **Live updates:** No submit button; results on every input change
- **Omit:** "Add to case note" (broker-only)
- **Optional:** Pre-fill loan/value/income from `GET /api/portal/cases/:id`
- **Disclaimer:** Guidance-only footer required

---

## 7. Design tokens (copy from KO-Broker `context/ui-context.md`)

| Role | Token | Hex |
|------|-------|-----|
| Brand primary | `brand-teal-700` | `#0F6E56` |
| Brand hover | `brand-teal-500` | `#1D9E75` |
| Brand light bg | `brand-teal-50` | `#E1F5EE` |
| Body text | `ink` | `#0D1F1A` |
| Page background | `surface` | `#F7FBF9` |
| Active nav | `brand-teal-50` + border |
| Adviser avatar | gold/amber circle |

**Rules:**
- No hardcoded hex in components — use Tailwind tokens
- `cn()` via clsx + tailwind-merge
- shadcn/ui for Button, Input, Checkbox, Dialog (invite modal)

---

## 8. Code patterns (mirror broker `apps/web`)

### 8.1 API client (`lib/api/client.ts`)

```typescript
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export async function portalFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  return res.json();
}
```

### 8.2 React Query hooks

```typescript
// hooks/use-portal-case.ts
export function usePortalCase() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['portal', 'case'],
    queryFn: async () => {
      const token = await getToken();
      const res = await portalFetch<PortalCaseDetail>('/api/portal/cases', { token });
      if (!res.success) throw new ApiError(res.error);
      return res.data;
    },
  });
}
```

### 8.3 Auth guard

`ClientAuthGuard` wraps `(dashboard)/layout.tsx`:
- Uses Clerk `useAuth()` — redirect to `/invite` if no session
- Unlike broker, **no** `orgId` scoping — client sees only their own data (enforced server-side)

### 8.4 Middleware (`proxy.ts`)

Match broker pattern:
- Public: `/invite`, `/verify`, `/api/health`
- Protected: `/overview`, `/application`, `/messages`, `/tools`
- Root `/` → redirect based on session

---

## 9. Environment variables (`.env.example`)

```bash
# App
NEXT_PUBLIC_APP_URL="http://localhost:3002"
NEXT_PUBLIC_API_URL="http://localhost:3001"   # KO-Broker API origin

# Clerk (separate Clerk application for clients)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
CLERK_SECRET_KEY=""
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/invite"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/overview"

# Feature flags
NEXT_PUBLIC_USE_MOCK_API="true"             # false when broker portal APIs ship
```

**No** `DATABASE_URL` in client repo unless you add a BFF layer later.

---

## 10. Mock data (development)

Create `lib/api/portal-data.ts` with:

```typescript
export const MOCK_PORTAL_SESSION = {
  client: {
    firstName: 'Alex',
    lastName: 'Taylor',
    email: 'alex@example.com',
  },
  adviser: {
    firstName: 'James',
    lastName: 'Davies',
    initials: 'JD',
    phone: '+44 7700 900 000',
    email: 'james@kodavis.co.uk',
    title: 'Your Mortgage Advisor',
  },
  case: {
    referenceNumber: 'KOF-2025-0042',
    stage: 'DIP',
    clientStageLabel: 'KIP Submitted',
    type: 'PURCHASE',
  },
  tasks: [
    { id: '1', label: "Upload your last 3 months' payslips", completed: false },
    { id: '2', label: 'Upload a bank statement from the past 3 months', completed: true },
    { id: '3', label: 'Confirm your employment start date', completed: true },
  ],
  progressSteps: [
    { label: 'Information Gathering', status: 'completed' },
    { label: 'Broker Review', status: 'completed' },
    { label: 'KIP Submitted', status: 'in_progress' },
    { label: 'Mortgage Offer', status: 'pending' },
  ],
};
```

Gate with `NEXT_PUBLIC_USE_MOCK_API=true`.

---

## 11. CI pipeline (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build
```

---

## 12. What NOT to build (scope boundaries)

| Out of scope | Reason |
|--------------|--------|
| Marketing / landing page | Product decision — dashboard only |
| Broker CRM features | Lives in KO-Broker |
| Database / Prisma in client repo | Client reads broker API |
| Modifying KO-Broker repo | Separate deployment |
| AI suitability reports | Broker-only |
| Compliance engine UI | Broker-only |
| Team billing / org settings | Broker-only |
| Self-registration | Clients are invite-only |

---

## 13. Integration checklist (when broker APIs ship)

Broker team (KO-Broker repo) will add — **without breaking existing broker features**:

- [ ] Generate `portalAccessToken` on invite
- [ ] `POST /api/portal/invite/send-otp` + email via Resend
- [ ] Portal-scoped auth middleware (token + Clerk client app)
- [ ] `portalEnabled` gate on all portal routes
- [ ] Plan feature check: `client_portal` on PROFESSIONAL+ orgs

Client team (this repo):

- [ ] Set `NEXT_PUBLIC_USE_MOCK_API=false`
- [ ] Point `NEXT_PUBLIC_API_URL` to broker production API
- [ ] E2E test: invite link → OTP → overview → upload doc → send message

---

## 14. README snippet (for new repo)

```markdown
# KO Client Platform

Client-facing portal for KO Broker Platform. Mortgage clients invited by their broker can track application progress, complete fact-find forms, upload documents, and message their adviser.

**Sibling repo:** [KO-Broker](https://github.com/...) — broker CRM and API backend.

## Quick start

pnpm install
cp .env.example .env.local
pnpm dev          # http://localhost:3002

## Routes

| Path | Description |
|------|-------------|
| `/invite?token=` | Welcome modal + OTP (entry point) |
| `/overview` | Dashboard home |
| `/application` | Fact-find wizard |
| `/messages` | Adviser messaging |
| `/tools` | Mortgage calculators (Phase 2) |
```

---

## 15. Step-by-step Cursor execution order

When pasting into a new Cursor instance, run these tasks in order:

1. **Init monorepo** — pnpm workspace, root configs, tooling/eslint-config
2. **Copy/sync `@ko/types`** from KO-Broker
3. **Scaffold `apps/client`** — Next.js 16, Tailwind v4, fonts, providers (Clerk + React Query)
4. **Design tokens** — tailwind config matching broker `ui-context.md`
5. **Auth shell** — `proxy.ts`, invite + verify routes, `ClientAuthGuard`
6. **Invite welcome modal** — match mockup (illustration, dynamic placeholders, Send Verification)
7. **Dashboard shell** — sidebar nav with 4 items
8. **Overview page** — stepper + next steps + adviser card
9. **Application page** — 8-section fact-find step nav + form placeholder
10. **Messages + Tools** — placeholder pages with correct layout
11. **Mock API layer** — `portal-data.ts` + hooks
12. **CI + README + .env.example**
13. **Doc/API-CONTRACT.md** — portal endpoint spec for broker team

---

## 16. Acceptance criteria

- [ ] Repo structure mirrors KO-Broker monorepo conventions
- [ ] No landing page; `/` redirects appropriately
- [ ] Invite flow shows welcome modal with OTP CTA (mocked)
- [ ] Overview matches mockup: progress stepper, next steps checklist, adviser card
- [ ] Sidebar nav: Overview, My Application, Messages, Mortgage Tools
- [ ] Uses `@ko/types` API envelope and enums
- [ ] `NEXT_PUBLIC_USE_MOCK_API=true` works offline without broker running
- [ ] Typecheck, lint, and build pass in CI
- [ ] Zero files changed in KO-Broker repository

---

*Generated for KO Broker Platform · Luxcity Technology · Aligns with PRD-13 (Client Portal Phase 2)*
