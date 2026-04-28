

**KO BROKER PLATFORM**

Product & Engineering — Modular PRD Set

| Document type | Modular PRD Set (PRD-00 through PRD-14) |
| :---- | :---- |
| **Audience** | Head of Design & Engineering, Technical PM, UI/UX Strategist, Backend Engineer |
| **Client** | KO Realtors (KO Financials) |
| **Prepared by** | Luxcity Technology |
| **Version** | v1.0 |
| **Date** | April 2026 |
| **Reference prototype** | KO Platform v2a (HTML) |

| How to use this document This file contains all 15 modular PRDs in sequence (PRD-00 to PRD-14). Each PRD is self-contained: it has a purpose, owner, task table, acceptance criteria, and technical spec. Work through them in PRD number order — each builds on the previous. The team assignment document is at the end (Section B). PRD-00 through PRD-05 must be complete before any feature PRD (PRD-06+) is started. PRDs 06–12 can be parallelised across the team. PRD-13 (Client Portal) and PRD-14 (DevOps) are ongoing. |
| :---- |

| PRD-00 Master Index, Conventions & Done Criteria Owner: Head of D\&E    Phase: Foundation |
| :---- |

## **Purpose**

PRD-00 establishes the shared conventions, definition of done, and branching rules that govern every other PRD in this set. Every team member must read this before starting any work.

## **PRD Index**

| PRD | Title | Owner | Phase | Sprint |
| :---- | :---- | :---- | :---- | :---- |
| PRD-00 | Master index, conventions & done criteria | Head of D\&E | Foundation | Pre-sprint |
| PRD-01 | Landing page & design system | UI/UX \+ Head of D\&E | MVP | Sprint 1 |
| PRD-02 | Foundation & monorepo architecture | Head of D\&E | Foundation | Sprint 1 |
| PRD-03 | Database schema & Supabase setup | Backend Eng | Foundation | Sprint 1 |
| PRD-04 | Authentication & multi-tenancy | Backend Eng \+ Head of D\&E | Foundation | Sprint 1 |
| PRD-05 | API layer, handler pattern & routing | Backend Eng | Foundation | Sprint 1 |
| PRD-06 | Client & case management (CRM) | Tech PM \+ UI/UX | MVP | Sprint 2 |
| PRD-07 | Compliance engine & audit trail | Backend Eng \+ Tech PM | MVP | Sprint 2–3 |
| PRD-08 | Forms & fact-find system | UI/UX \+ Backend Eng | MVP | Sprint 2–3 |
| PRD-09 | AI report generation | Head of D\&E \+ Backend Eng | MVP | Sprint 3–4 |
| PRD-10 | Messages & notifications | Backend Eng \+ UI/UX | MVP | Sprint 3–4 |
| PRD-11 | Calculators & tools | UI/UX \+ Tech PM | MVP | Sprint 3 |
| PRD-12 | Settings, billing & plan gating | Backend Eng \+ Head of D\&E | MVP | Sprint 4 |
| PRD-13 | Client portal (Phase 2\) | Tech PM \+ UI/UX | Phase 2 | Sprint 6+ |
| PRD-14 | DevOps, Docker & deployment | Head of D\&E | Foundation \+ Ongoing | Sprint 1 \+ ongoing |

## **Shared Conventions**

### **Naming**

* All component files: PascalCase (e.g. CaseCard.tsx)

* All API route files: route.ts (Next.js App Router convention)

* All utility files: camelCase (e.g. buildReportPrompt.ts)

* Database models: PascalCase (e.g. SuitabilityReport)

* Database fields: camelCase (e.g. assignedAdviserId)

* Environment variables: SCREAMING\_SNAKE\_CASE

### **Branching model (GitHub)**

| Branch naming convention feature/PRD-06-case-kanban   (feature branches) fix/PRD-07-compliance-stage-gate   (bug fixes) chore/PRD-02-monorepo-setup   (infrastructure) Rules: (1) All work on feature branches. (2) PRs require review from Head of D\&E before merge to main. (3) No direct pushes to main. (4) Branch from main; rebase before PR. (5) CI must pass (typecheck \+ lint \+ unit tests) before PR is reviewable. |
| :---- |

### **Universal Definition of Done**

* Feature builds without TypeScript errors (tsc \--noEmit passes)

* ESLint passes with zero warnings

* Unit tests written for all logic functions; all pass

* API routes tested manually via the /api/health endpoint pattern or Postman collection

* Component renders without console errors

* Mobile-responsive: tested at 375px and 1280px viewport widths

* PR description links to the relevant PRD section

* Head of D\&E has reviewed and approved the PR

### **Stack constraints (zero-cost MVP)**

| All tooling must be zero-cost at MVP scale. These are the approved free-tier services: Vercel — free hobby tier for frontend \+ API (upgrade to Pro for production custom domain) Supabase — free tier: 500MB DB, 1GB storage, 50MB file uploads Clerk — free tier: up to 10,000 monthly active users Azure AI Foundry — AI report generation. Azure credits applied first; pay-per-token beyond credits. Model selection optimised for cost in PRD-09. Resend — free tier: 3,000 emails/month Twilio — pay-per-SMS (trial credit available; cost passed to client) Cloudflare R2 — free tier: 10GB storage, 1M reads/month GitHub — free for public repos; private repos included in free tier (up to 3 collaborators) Docker Hub — free for public images; or GitHub Container Registry (free with GitHub) |
| :---- |

| PRD-01 Landing Page & Design System Owner: UI/UX Strategist \+ Head of D\&E    Phase: Sprint 1 |
| :---- |

## **Purpose**

Establish the KO Platform design system (tokens, components, typography) and deliver the public-facing marketing landing page as defined in the v2a prototype. This PRD must be completed before any dashboard UI work begins, as it defines the shared design language.

## **Design System**

### **Colour tokens (tailwind.config.ts)**

| Token | Hex | Usage |
| :---- | :---- | :---- |
| brand.teal-700 | \#0F6E56 | Primary brand, H1 headings, CTA buttons, nav logo |
| brand.teal-500 | \#1D9E75 | Hover states, active nav, accent |
| brand.teal-400 | \#5DCAA5 | Hero text highlight, score bars |
| brand.teal-100 | \#9FE1CB | Avatar backgrounds (research stage) |
| brand.teal-50 | \#E1F5EE | Active nav background, info boxes, teal-bg cards |
| stage.enquiry.bg / text | \#EFF6FF / \#1D4ED8 | Enquiry stage throughout app |
| stage.factfind.bg / text | \#FFF7ED / \#C2410C | Fact-Find stage |
| stage.research.bg / text | \#F0FDF4 / \#166534 | Research stage |
| stage.dip.bg / text | \#FAF5FF / \#7E22CE | DIP stage |
| stage.offer.bg / text | \#FFF1F2 / \#BE123C | Offer stage |
| ink | \#0D1F1A | Body text |
| surface | \#F7FBF9 | Page background (dashboard) |

### **Typography**

| Heading font | Syne (Google Fonts) — weights 400, 600, 700, 800 |
| :---- | :---- |
| **Body font** | DM Sans (Google Fonts) — weights 300, 400, 500 |
| **Monospace** | Courier New (system) — code blocks only |
| **Base size** | 22pt (11px equivalent in 2x) \= 22 in docx-js / 14px in Tailwind |
| **H1** | 56–60px, 800 weight, letter-spacing: −0.02em |
| **H2** | 42px, 800 weight |
| **H3** | 28–32px, 700 weight |
| **Body** | 18px, 300–400 weight, line-height 1.65 |

### **Component library**

* shadcn/ui as the base component library. Install via: npx shadcn@latest init

* Custom components built on top of shadcn primitives, never replacing them

* Components live in /apps/web/components/ui/ (shadcn) and /apps/web/components/marketing/ (landing) and /apps/web/components/dashboard/ (app)

## **Landing Page Sections**

The landing page maps exactly to the v2a prototype. Implement in /apps/web/app/(marketing)/page.tsx.

### **Section 1: Navigation bar**

* Fixed, full-width, backdrop blur on scroll (bg-opacity: 85%, blur: 16px)

* Logo: inline SVG house icon \+ "KO Platform" wordmark in Syne 700

* Nav links: Features, Pricing, Live Demo (scrolls or routes)

* "Sign in" (ghost button) and "Start free trial" (filled brand button)

* Mobile: hamburger menu collapses nav links

### **Section 2: Hero**

* Radial gradient glow behind headline (teal, 22% opacity)

* Tag badge: pulsing dot \+ "Built for UK mortgage brokerages"

* H1: "The smarter broker platform" with em tag on "smarter" → teal-400 colour

* Subheadline: 18px, 300 weight, max-width 540px, centred

* Two CTAs: "Open live demo" (primary, links to /dashboard) and "Book a walkthrough" (ghost)

* Hero mockup: styled div replicating the dashboard in miniature, with five kanban columns each using stage colourways (matches v2a exactly)

### **Section 3: Pain points strip**

* Three-column grid, separated by 1px dividers

* Icons: emoji or lucide-react SVG

* Columns: "30–60 min per lender search", "Fragmented compliance docs", "Enterprise tools out of reach"

### **Section 4: Features**

* 5-column grid of feature cards (matches the 5 platform modules)

* Each card: icon box (teal-500, 15% opacity background), title (Syne bold), 2-line description

* AI Report Generation card has a distinct teal-50 background to stand out

### **Section 5: Stats strip**

* Three-column, text-centred stats: 5,000+ / 65% / 30 min

* Stat numbers in Syne 800, teal-400 colour, 52px

### **Section 6: Pricing**

* Three-card layout: Starter £35, Professional £50 (featured, teal-700 background), Enterprise £75

* Professional card has "Most popular" badge (teal-400, absolutely positioned)

* "Try the demo" CTA on Professional card routes to /dashboard

### **Section 7: Footer**

* Logo left, copyright right, single border-top

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Set up Tailwind config with all brand \+ stage tokens | **UI/UX** | 2 hrs | **P0** |
| Configure Google Fonts (Syne \+ DM Sans) in layout.tsx | **UI/UX** | 1 hr | **P0** |
| Install and configure shadcn/ui | **Head of D\&E** | 1 hr | **P0** |
| Build nav component (sticky, blur, mobile hamburger) | **UI/UX** | 3 hrs | **P0** |
| Build hero section with mockup div | **UI/UX** | 4 hrs | **P0** |
| Build pain points, features, stats, pricing sections | **UI/UX** | 4 hrs | **P0** |
| Build footer, mobile responsiveness pass | **UI/UX** | 2 hrs | P1 |
| Design system documentation in /docs/design-system.md | **Head of D\&E** | 1 hr | P1 |

## **Acceptance Criteria**

* Landing page renders correctly on 375px, 768px, and 1440px viewports

* All six sections present with real copy (no Lorem Ipsum)

* Tailwind brand tokens available in all downstream components

* shadcn/ui installed and at least Button, Card, Badge components verified working

* Lighthouse performance score \>= 85 on landing page

| PRD-02 Foundation & Monorepo Architecture Owner: Head of Design & Engineering    Phase: Sprint 1 |
| :---- |

## **Purpose**

Bootstrap the monorepo, establish the project structure, configure all tooling, and ensure every developer can run the app locally within 10 minutes of cloning.

## **Monorepo Structure**

| Path | Purpose | Owner |
| :---- | :---- | :---- |
| /apps/web | Next.js 14 application (frontend \+ API) | Head of D\&E |
| /apps/web/app/(marketing) | Public landing page route group | UI/UX |
| /apps/web/app/(dashboard) | Protected app route group | UI/UX \+ Tech PM |
| /apps/web/app/api | Route handlers (all backend logic) | Backend Eng |
| /apps/web/components/ui | shadcn/ui primitives | UI/UX |
| /apps/web/components/marketing | Landing page components | UI/UX |
| /apps/web/components/dashboard | App shell \+ shared dashboard components | UI/UX |
| /apps/web/lib | Shared utilities: auth, db, ai, calculators | Backend Eng |
| /packages/db | Prisma schema \+ generated client (shared) | Backend Eng |
| /packages/types | Shared TypeScript types \+ Zod schemas | Backend Eng |
| /packages/utils | Shared pure utility functions | Head of D\&E |
| /tooling/eslint-config | Shared ESLint config | Head of D\&E |
| /docker | Dockerfile, docker-compose.yml | Head of D\&E |
| /docs | PRDs, design system, API docs | Tech PM |

## **Key Configuration Files**

### **pnpm-workspace.yaml**

packages:  \- 'apps/\*'  \- 'packages/\*'  \- 'tooling/\*'

### **tsconfig.json (root)**

Strict mode enabled. Path aliases: @ko/db, @ko/types, @ko/utils mapped to respective packages.

### **.env.example**

Must list every variable with descriptive comment. No values. Template committed to repo.

| Variable | Service | Required for |
| :---- | :---- | :---- |
| DATABASE\_URL | Supabase | All DB operations |
| DIRECT\_URL | Supabase | Prisma migrations (bypasses pooler) |
| NEXT\_PUBLIC\_CLERK\_PUBLISHABLE\_KEY | Clerk | Frontend auth |
| CLERK\_SECRET\_KEY | Clerk | Server auth |
| CLERK\_WEBHOOK\_SECRET | Clerk | Webhook verification (svix) |
| AZURE\_AI\_FOUNDRY\_ENDPOINT | Azure AI Foundry | AI report generation (model endpoint URL) |
| AZURE\_AI\_FOUNDRY\_API\_KEY | Azure AI Foundry | AI report generation (API key) |
| AZURE\_AI\_FOUNDRY\_DEPLOYMENT\_NAME | Azure AI Foundry | Deployed model name (e.g. gpt-4o, phi-3-mini) |
| R2\_ACCOUNT\_ID | Cloudflare R2 | File storage |
| R2\_ACCESS\_KEY\_ID | Cloudflare R2 | File storage |
| R2\_SECRET\_ACCESS\_KEY | Cloudflare R2 | File storage |
| R2\_BUCKET\_NAME | Cloudflare R2 | File storage |
| RESEND\_API\_KEY | Resend | Email delivery |
| RESEND\_FROM\_EMAIL | Resend | From address |
| TWILIO\_ACCOUNT\_SID | Twilio | SMS |
| TWILIO\_AUTH\_TOKEN | Twilio | SMS |
| TWILIO\_FROM\_NUMBER | Twilio | SMS |
| NEXT\_PUBLIC\_APP\_URL | App | Email links, callbacks |

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Initialise pnpm monorepo with workspaces | **Head of D\&E** | 2 hrs | **P0** |
| Bootstrap Next.js 14 app with App Router \+ TypeScript strict | **Head of D\&E** | 1 hr | **P0** |
| Configure path aliases in tsconfig.json | **Head of D\&E** | 1 hr | **P0** |
| Set up ESLint \+ Prettier with shared config | **Head of D\&E** | 1 hr | **P0** |
| Create .env.example with all variables documented | **Backend Eng** | 1 hr | **P0** |
| Add Makefile with dev, db:push, db:seed, typecheck, lint targets | **Head of D\&E** | 1 hr | P1 |
| Verify all team members can run locally (README onboarding) | **Head of D\&E** | 2 hrs | **P0** |

## **Acceptance Criteria**

* git clone \+ pnpm install \+ pnpm dev runs the app locally without errors

* All packages resolve correctly via path aliases

* tsc \--noEmit and eslint pass with zero errors from day one

* README includes setup steps completable in under 10 minutes

| PRD-03 Database Schema & Supabase Setup Owner: Backend Software Engineer    Phase: Sprint 1 |
| :---- |

## **Purpose**

Define and migrate the complete PostgreSQL schema via Prisma, configure Supabase, and seed realistic demo data. This is a hard dependency for all feature PRDs.

## **Supabase Setup**

* Create a new Supabase project (free tier). Region: EU West (Ireland) for UK data residency.

* Connection: use the connection pooler URL for DATABASE\_URL; use the direct connection URL for DIRECT\_URL (migrations only).

* Enable Row Level Security (RLS) on all tables. Note: RLS is a secondary guard; primary isolation is enforced at the Prisma/API layer.

## **Schema Overview**

All models are in /packages/db/prisma/schema.prisma. All IDs use @default(cuid()). All timestamps use @default(now()). Every table has orgId except User (scoped via Clerk organisation) and LenderCriteria (global reference data).

| Model | Key fields | Relations |
| :---- | :---- | :---- |
| Organisation | id, name, slug, plan, stripeCustomerId | Users, Clients, Cases, Subscriptions |
| User | id, clerkId, email, firstName, lastName, role, orgId | Organisation, assigned Cases |
| Client | id, orgId, referenceNumber, personal fields, employmentStatus, isVulnerable | Cases, Documents, Messages |
| Case | id, orgId, clientId, referenceNumber, type, stage, financial fields, selectedProduct fields | Client, FactFind, ComplianceRecords, Messages, Documents, SuitabilityReport |
| FactFind | id, caseId (unique), all fact-find JSON blobs, completedAt | Case |
| ProductConsidered | id, caseId, lenderName, productName, rate, fee, isSelected, reasonNotSelected | Case |
| ComplianceRecord | id, caseId, stage, completedAt, documentUrl, isApproved | Case, User |
| SuitabilityReport | id, caseId, templateType, status, sections (JSON), pdfUrl | Case, User |
| Message | id, orgId, caseId?, clientId?, direction, channel, sourceType, body, isRead, threadId | Organisation, Case, Client |
| Document | id, orgId, caseId?, clientId?, name, documentType, storageUrl, mimeType, sizeBytes | Organisation, Case, Client |
| AuditLog | id, orgId, userId, entityType, entityId, action, diff (JSON), notificationSent | Organisation, User |
| LenderCriteria | id, lenderName, maxLtv, minIncome, maxLoanAmount, acceptedEmploymentTypes, minCreditScore, specialConditions (JSON) | (global) |

### **Enums**

* Plan: STARTER | PROFESSIONAL | ENTERPRISE

* Role: ADMIN | ADVISER | COMPLIANCE | VIEWER

* EmploymentStatus: EMPLOYED | SELF\_EMPLOYED | CONTRACTOR | RETIRED | UNEMPLOYED

* CaseType: PURCHASE | REMORTGAGE | BTL | FURTHER\_ADVANCE | PRODUCT\_TRANSFER

* CaseStage: ENQUIRY | FACT\_FIND | RESEARCH | DIP | OFFER | COMPLETION | ARCHIVED

* ReportTemplate: BTL | FTB | REMORTGAGE | HOME\_MOVER | PRODUCT\_TRANSFER | DIVORCE | SELF\_EMPLOYED | VULNERABLE\_OVERLAY

* ReportStatus: DRAFT | ADVISER\_REVIEW | APPROVED | FINALISED

* MessageDirection: INBOUND | OUTBOUND | SYSTEM

* MessageChannel: EMAIL | SMS | IN\_APP

* MessageSource: CASE\_UPDATE | COMPLIANCE | AI\_REPORT | CLIENT\_REPLY | SYSTEM

* DocumentType: ID | INCOME | FINANCIAL | LENDER | COMPLIANCE | OTHER

### **Seed data**

* 1 Organisation: KO Financials, plan: PROFESSIONAL

* 3 Users: Admin (Sarah Davies), Adviser (James Osei), Compliance officer

* 15 LenderCriteria: Halifax, Nationwide, Barclays, NatWest, Santander, HSBC, Leeds BS, Virgin Money, Platform, Accord, Kent Reliance, Precise, Kensington, Pepper Money, Bluestone

* 6 Clients across all employment types and vulnerability statuses

* 6 Cases across all 5 pipeline stages; 1 completed case

* FactFinds for Research-stage cases and beyond

* ProductConsidered records (min 3 per Research-stage case)

* One complete approved SuitabilityReport for the Offer-stage case

* Sample AuditLog and Message records for each case

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Write complete Prisma schema with all models and enums | **Backend Eng** | 4 hrs | **P0** |
| Configure Supabase project and connection strings | **Backend Eng** | 1 hr | **P0** |
| Run prisma migrate dev to apply initial migration | **Backend Eng** | 1 hr | **P0** |
| Write seed script with all demo data | **Backend Eng** | 3 hrs | **P0** |
| Verify RLS is enabled; document bypass pattern for seed | **Backend Eng** | 1 hr | P1 |
| Write Prisma client singleton for Next.js (lib/db/index.ts) | **Backend Eng** | 1 hr | **P0** |

## **Acceptance Criteria**

* prisma db push succeeds against Supabase without errors

* prisma db seed populates all demo data; app is fully usable with seed data

* All foreign key constraints enforced

* Prisma client imported correctly in API routes without connection pool exhaustion in dev

| PRD-04 Authentication & Multi-Tenancy Owner: Backend Eng \+ Head of D\&E    Phase: Sprint 1 |
| :---- |

## **Purpose**

Implement Clerk-based authentication, route protection, and multi-tenant data isolation. No feature work should begin until this PRD is complete and verified.

## **Clerk Setup**

* Create Clerk application. Enable: Email \+ Password, Google OAuth (optional), Organisation support.

* Set allowed origins and webhook endpoints in Clerk dashboard.

* Webhook URL: {APP\_URL}/api/webhooks/clerk. Events to subscribe: user.created, organization.created, organization\_membership.created.

## **Middleware (apps/web/middleware.ts)**

* Protect all routes matching /dashboard(.\*) and /api(?\!/webhooks)(.\*).

* Allow public: /, /(marketing)(.\*), /api/webhooks/(.\*), /api/health, /sign-in, /sign-up.

* On authenticated requests: extract clerkUserId and orgId from Clerk session.

* Inject headers: x-user-id (DB User.id), x-org-id (Organisation.id), x-user-role (Role enum).

* Look up User by clerkId on first load; cache in session or short-lived in-memory cache.

## **Auth helper functions (lib/auth/index.ts)**

* getCurrentUser(): Promise\<User | null\> — reads headers, queries DB

* requireAuth(): Promise\<User\> — throws AuthError (401) if not authenticated

* requireRole(role: Role): Promise\<User\> — throws AuthError (403) if wrong role

* getOrgId(): string — throws if no org in session

## **Webhook handler (/api/webhooks/clerk/route.ts)**

* Verify svix signature on every request. Return 400 on invalid signature.

* user.created → create User record in DB with clerkId. Do not error if already exists (upsert).

* organization.created → create Organisation with plan: STARTER and a generated slug.

* organization\_membership.created → upsert User-Organisation link with default role: ADVISER.

## **Role-based access control**

| Action | ADMIN | ADVISER | COMPLIANCE | VIEWER |
| :---- | :---- | :---- | :---- | :---- |
| Create/edit clients and cases | ✓ | ✓ | ✗ | ✗ |
| View all clients and cases | ✓ | ✓ | ✓ | ✓ |
| Advance compliance stages | ✓ | ✓ | ✓ | ✗ |
| Approve suitability reports | ✓ | ✓ | ✓ | ✗ |
| Send messages to clients | ✓ | ✓ | ✗ | ✗ |
| Invite and manage team members | ✓ | ✗ | ✗ | ✗ |
| Access billing and settings | ✓ | ✗ | ✗ | ✗ |

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Configure Clerk application and webhook subscriptions | **Head of D\&E** | 1 hr | **P0** |
| Write and test middleware.ts with route protection | **Backend Eng** | 3 hrs | **P0** |
| Implement auth helper functions in lib/auth/index.ts | **Backend Eng** | 2 hrs | **P0** |
| Implement Clerk webhook handler with signature verification | **Backend Eng** | 2 hrs | **P0** |
| Write integration tests for tenant isolation (org A vs org B) | **Backend Eng** | 2 hrs | **P0** |
| Document role matrix and enforce in createHandler factory | **Backend Eng** | 1 hr | **P0** |

## **Acceptance Criteria**

* Unauthenticated request to /dashboard returns redirect to /sign-in

* Authenticated user from Org A cannot retrieve any data belonging to Org B under any API endpoint

* Clerk webhook creates User and Organisation DB records on sign-up

* requireRole(ADMIN) on an ADVISER session returns 403

| PRD-05 API Layer, Handler Pattern & Routing Owner: Backend Software Engineer    Phase: Sprint 1 |
| :---- |

## **Purpose**

Establish the reusable API handler factory that every route handler in the app uses. This ensures consistent error handling, auth, validation, and response shape across the entire API surface.

## **Handler factory (lib/api/handler.ts)**

All route handlers must use createHandler(config). Config options:

* method: HTTP method (GET | POST | PATCH | DELETE | PUT)

* requireAuth: boolean (default true)

* requiredRole: Role (optional)

* schema: ZodSchema for request body validation (POST/PATCH/PUT only)

* handler: async function receiving (req, context) with typed body, user, and orgId

### **Response envelope (all routes)**

| Success response { "success": true, "data": \<T\>, "meta": { "total": number, "page": number, "perPage": number } } Error response { "success": false, "error": { "code": string, "message": string, "fields"?: Record\<string,string\> } } |
| :---- |

### **HTTP status code map**

| Condition | Status code | Error code |
| :---- | :---- | :---- |
| Successful operation | 200 / 201 | n/a |
| Zod validation failure | 422 | VALIDATION\_ERROR |
| Not authenticated | 401 | UNAUTHORIZED |
| Insufficient role | 403 | FORBIDDEN |
| Feature requires higher plan | 403 | PLAN\_LIMIT\_EXCEEDED |
| Resource not found | 404 | NOT\_FOUND |
| Business logic error (e.g. stage skip) | 422 | BUSINESS\_RULE\_VIOLATION |
| Internal server error | 500 | INTERNAL\_ERROR |

### **Pagination**

* All list endpoints support query params: page (default 1), perPage (default 25, max 100\)

* Response meta always includes total, page, perPage

* Frontend uses TanStack Query for data fetching and cache management

## **Route structure**

Route files live under /apps/web/app/api/. Full route listing is in the master PRD (Section 5 of the previous PRD document). All routes follow the Next.js App Router convention (GET/POST/PATCH/DELETE exported from route.ts).

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Write createHandler factory in lib/api/handler.ts | **Backend Eng** | 3 hrs | **P0** |
| Write base Zod schemas in /packages/types for all entities | **Backend Eng** | 3 hrs | **P0** |
| Implement /api/health route | **Backend Eng** | 1 hr | **P0** |
| Implement /api/webhooks/clerk route (from PRD-04) | **Backend Eng** | 2 hrs | **P0** |
| Set up TanStack Query provider in dashboard layout | **Head of D\&E** | 1 hr | **P0** |
| Write API client helper (lib/api/client.ts) for typed fetch | **Head of D\&E** | 2 hrs | P1 |

## **Acceptance Criteria**

* All route handlers use createHandler; zero raw try/catch in route files

* /api/health returns 200 with DB: true and AI: true (once API key is set)

* ZodError on any POST body returns 422 with field-level error messages

* Attempting to call a protected route without auth returns 401 in under 50ms

| PRD-06 Client & Case Management (CRM) Owner: Tech PM \+ UI/UX Strategist    Phase: Sprint 2 |
| :---- |

## **Purpose**

Build the core CRM: client list, case pipeline (kanban \+ table), and the deep case detail view with five sub-tabs. This is the primary daily-use surface for advisers.

## **Client List (/dashboard/clients)**

* Data table: Name \+ email (stacked), Reference (KOC-YYYY-NNNN), Employment, Income, Status pill, Cases count, Messages badge, Adviser

* Filter bar: status dropdown, free-text search (name, email, reference)

* Per-row "Message" button: opens Messages hub pre-filtered to that client

* New Client slide-over: react-hook-form, Zod validation, all Client fields

* Pagination: 25 per page default, page controls at bottom

## **Case Pipeline (/dashboard/cases)**

### **Kanban view**

* Five columns with stage colourways (from design tokens in PRD-01)

* Column header: stage name, count badge

* Card contents: client name, case type, loan amount, LTV, adviser avatar, optional product-selected indicator

* Cards are clickable; click navigates to case detail

* Drag-and-drop to move cases between stages using @dnd-kit/core

* Drag fires PATCH /api/cases/\[id\] to update stage; optimistic UI

### **Table view**

* Toggle from sub-nav tabs

* Columns: Reference, Client, Type, Lender, Amount, LTV, Stage, Messages, Adviser, Updated

* Sortable columns; click header to sort asc/desc

* Messages column: shows unread count, coloured red for inbound replies

## **Case Detail (/dashboard/cases/\[id\])**

The case detail is a full-screen view (replaces dashboard content) with a back arrow and five sub-tabs. Sub-tab state is managed by URL query param (?tab=overview) so it is shareable.

| Tab | Key content | Data sources |
| :---- | :---- | :---- |
| Overview | Case \+ client details (2-col), colour-coded timeline with notification flags, messages preview \+ inline send bar, adviser notes | Case, Client, AuditLog, Messages |
| Documents | Upload \+ list of documents with type, status, uploader, date. Signed URL download. | Documents, R2 storage |
| Compliance | Five-stage stepper auto-reflecting current stage, checklist items, advance-stage CTA, inline client message bar | ComplianceRecord, Case |
| Messages | Full embedded thread: all messages for this case, inbound/outbound/system bubbles, reply input | Messages |
| AI Report | Report status card: draft/approved/finalised; link to full editor. Guard if product not selected. | SuitabilityReport |

### **Timeline logic**

* Timeline entries sourced from AuditLog WHERE entityId \= caseId OR clientId \= case.clientId

* Each entry: colour-coded dot (maps to stage colour when applicable), title, timestamp

* Entries with notificationSent: true show "notification sent" annotation in blue

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Build /api/clients (GET list, POST create, GET \[id\], PATCH \[id\]) | **Backend Eng** | 3 hrs | **P0** |
| Build /api/cases (GET list, POST create, GET \[id\], PATCH \[id\]) | **Backend Eng** | 3 hrs | **P0** |
| Build client list page with table, filters, pagination | **Tech PM** | 4 hrs | **P0** |
| Build new client slide-over form (react-hook-form \+ Zod) | **UI/UX** | 3 hrs | **P0** |
| Build case pipeline page: kanban with stage colourways | **UI/UX** | 5 hrs | **P0** |
| Implement drag-and-drop on kanban (dnd-kit) | **Head of D\&E** | 3 hrs | P1 |
| Build case table view with sort and filter | **Tech PM** | 3 hrs | P1 |
| Build case detail header (back, title, meta, stage badge) | **UI/UX** | 2 hrs | **P0** |
| Build Overview, Documents tabs | **Tech PM \+ UI/UX** | 4 hrs | **P0** |
| Build Compliance, Messages tabs (wire up to PRD-07 and PRD-10) | **Backend Eng** | 3 hrs | P1 |
| Build AI Report tab (wire up to PRD-09) | **Tech PM** | 2 hrs | P1 |
| Implement timeline from AuditLog data | **Backend Eng** | 2 hrs | P1 |

## **Acceptance Criteria**

* New client can be created and immediately appears in the client list

* New case can be created and appears on the kanban in the correct column

* Case stage can be changed by drag-and-drop; persists on page refresh

* All five sub-tabs render without errors; each shows loading skeleton while fetching

| PRD-07 Compliance Engine & Audit Trail Owner: Backend Eng \+ Tech PM    Phase: Sprint 2-3 |
| :---- |

## **Purpose**

Implement the five-stage FCA advice workflow, compliance checklist system, vulnerable customer assessment, and immutable audit trail.

## **Stage workflow**

The compliance workflow is a linear state machine: INITIAL\_DISCLOSURE → FACT\_FIND → RESEARCH → ESIS → SUITABILITY\_REPORT. Moving to the next stage requires all checklist items for the current stage to be complete.

| Stage | Mandatory checklist items before advance | Client notification triggered |
| :---- | :---- | :---- |
| Initial Disclosure | Initial disclosure document uploaded | Email: welcome \+ disclosure link |
| Fact-Find | All fact-find sections complete; vulnerability assessment done | Email: fact-find confirmation |
| Research | Min 3 products recorded; selected product confirmed; adviser notes filled | Email: research update (optional) |
| ESIS | ESIS document uploaded or generated | Email: ESIS issued to client |
| Suitability Report | Report status \= FINALISED | Email: recommendation \+ PDF attached |

## **API: POST /api/compliance/advance**

* Body: { caseId: string, targetStage: ComplianceStage }

* Server validates: current stage is the stage immediately before targetStage (no skipping)

* Server validates: all checklist items for current stage are complete

* On success: creates ComplianceRecord for completed stage, updates Case.stage, creates AuditLog entry, triggers client notification (Resend \+ optional Twilio)

* On failure: returns 422 with BUSINESS\_RULE\_VIOLATION and list of outstanding checklist items

## **Vulnerable customer assessment**

* Questionnaire in fact-find flow (PRD-08). Factors scored 0–2 each across six domains: mental health, physical health, financial difficulty, life events, resilience, digital capability.

* Total score \>= 8 (out of 12): isVulnerable \= true on Client record

* Vulnerable flag shown as amber banner on case detail, compliance screen, and AI report screen

* When isVulnerable is true: vulnerable customer overlay report template is auto-suggested in PRD-09

## **Audit trail**

| Immutability rule AuditLog rows are INSERT-ONLY. No UPDATE or DELETE is ever issued against this table. This is enforced both by Prisma (no update/delete methods exposed for AuditLog) and by a Supabase RLS policy that denies UPDATE and DELETE for all roles. |
| :---- |

* logAuditEvent() in lib/compliance/audit.ts is called by every mutation handler

* Diff computed with deep-diff library comparing before/after snapshots

* Audit trail page (/dashboard/compliance/audit-trail): paginated table, filter by user, entity type, date range, case reference

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Write compliance workflow state machine (lib/compliance/workflow.ts) | **Backend Eng** | 3 hrs | **P0** |
| Implement /api/compliance/advance with checklist validation | **Backend Eng** | 3 hrs | **P0** |
| Write logAuditEvent() and call from all mutation handlers | **Backend Eng** | 2 hrs | **P0** |
| Build compliance screen in case detail (stepper \+ checklist \+ advance CTA) | **Tech PM** | 4 hrs | **P0** |
| Build audit trail page with filters | **Tech PM** | 3 hrs | P1 |
| Write vulnerable customer scoring logic and flag update | **Backend Eng** | 2 hrs | **P0** |
| Build amber vulnerable banner component (shown across app) | **UI/UX** | 1 hr | P1 |
| Set up Supabase RLS policy denying UPDATE/DELETE on AuditLog | **Backend Eng** | 1 hr | **P0** |

## **Acceptance Criteria**

* A case cannot advance from INITIAL\_DISCLOSURE to FACT\_FIND until disclosure document is uploaded

* Attempting to skip a stage returns 422 with clear error message

* Every case edit creates an AuditLog entry with before/after diff

* AuditLog table has zero rows with an updatedAt column (no updates possible)

* Vulnerable flag persists on Client and displays banner on all relevant screens

| PRD-08 Forms & Fact-Find System Owner: UI/UX Strategist \+ Backend Eng    Phase: Sprint 2-3 |
| :---- |

## **Purpose**

Build the digital fact-find form — the primary data collection tool for advisers. The fact-find is structured as a multi-step form with auto-save, and its data feeds the AI report generation in PRD-09.

## **Fact-find structure**

The fact-find is accessed via the case detail (Overview tab or Compliance tab). It is a multi-step wizard with seven sections. Progress is auto-saved after each section via PUT /api/cases/\[id\]/fact-find.

| Step | Section | Key fields |
| :---- | :---- | :---- |
| 1 | Personal details | Title, full name, DOB, NI number, address (current \+ 3 years), marital status, dependants |
| 2 | Employment details | Employment status, employer name, start date, contract type, payslip period |
| 3 | Income details | Gross annual salary, additional income types (bonus, overtime, rental, benefits), self-employed: SA302 \+ company accounts details |
| 4 | Expenditure details | Monthly: rent/mortgage, loans, credit cards, hire purchase, maintenance, childcare, other regular commitments |
| 5 | Property details | Property address, type, tenure (freehold/leasehold), estimated value, purchase price, new build flag, intended use (primary/BTL) |
| 6 | Existing mortgages | For each existing mortgage: lender, outstanding balance, monthly payment, rate, product end date, early repayment charge |
| 7 | Client preferences \+ vulnerability | Rate preference (fix/tracker/discount), initial period preference, max monthly payment, risk appetite, vulnerability assessment questionnaire |

### **Form implementation**

* Library: react-hook-form with zodResolver for each section

* Auto-save: debounced 2-second auto-save on change via PUT /api/cases/\[id\]/fact-find

* Progress indicator: persistent step indicator showing completion percentage

* Section status: completed / in-progress / not-started for each step

* Validation: inline field errors shown on blur; section cannot be marked complete until all required fields valid

* Data storage: each section stored as a named JSON field in FactFind model (not flat columns). This allows schema flexibility for Phase 2 additions.

### **Vulnerability assessment questionnaire (Step 7\)**

* Six domains, two questions each, scored 0–2 per question

* Domain scores summed; total \>= 8 triggers vulnerable flag on Client

* Adviser can override vulnerability flag with written justification (stored in vulnerabilityNotes)

## **New client slide-over form**

* Fields: title, first name, last name, email, phone, DOB, employment status, annual income

* On submit: POST /api/clients, show success toast, close slide-over, refresh client list

* Inline Zod validation errors on each field

## **New case modal**

* Fields: client (searchable dropdown from existing clients), case type, property value, loan amount, term (years), case purpose

* LTV auto-calculated from property value and loan amount

* On submit: POST /api/cases, navigate to new case detail page

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Build PUT /api/cases/\[id\]/fact-find with Zod schema per section | **Backend Eng** | 3 hrs | **P0** |
| Build multi-step fact-find wizard shell with progress bar | **UI/UX** | 4 hrs | **P0** |
| Build Steps 1–4 (personal, employment, income, expenditure) | **UI/UX** | 5 hrs | **P0** |
| Build Steps 5–7 (property, mortgages, preferences \+ vulnerability) | **UI/UX** | 5 hrs | **P0** |
| Implement auto-save with debounce and save indicator | **Head of D\&E** | 2 hrs | P1 |
| Build vulnerability scoring logic \+ flag write-back | **Backend Eng** | 2 hrs | **P0** |
| Build new client slide-over form | **UI/UX** | 2 hrs | **P0** |
| Build new case modal with LTV auto-calc | **UI/UX** | 2 hrs | **P0** |

## **Acceptance Criteria**

* All seven fact-find sections can be completed and saved

* Partially completed fact-find auto-saves; progress is preserved on page refresh

* Vulnerability questionnaire scores correctly and sets isVulnerable on Client

* Completed fact-find sets FactFind.completedAt and unlocks the Compliance advance to RESEARCH

| PRD-09 AI Suitability Report Generation Owner: Head of D\&E \+ Backend Eng    Phase: Sprint 3-4 |
| :---- |

## **Purpose**

Implement AI-powered suitability report generation using Azure AI Foundry. Azure credits offset the cost of inference; the deployment model is selected for the best balance of quality and cost for this use case. Every part of the generation, review, and approval flow must be adviser-gated.

## **Generation flow**

1. Adviser opens AI Reports tab on a case (or navigates to /dashboard/ai-reports)

2. System validates preconditions: fact-find complete, product selected, min 3 products considered

3. Adviser selects template type and clicks "Generate report"

4. POST /api/ai/generate-report called

5. Server builds structured prompt from case, fact-find, and product data

6. Azure AI Foundry endpoint called (model: see deployment config, max\_tokens: 4096, response\_format: json\_object). Model selected at deploy time — see Model Selection note below.

7. Response parsed; sections stored in SuitabilityReport.sections; status: DRAFT

8. UI renders report sections collapsed; adviser expands, reads, edits, or regenerates each section

9. Pre-finalisation compliance check runs (automated scan)

10. Adviser clicks "Approve & finalise"; status: FINALISED; PDF generated; optional email to client

## **Azure AI Foundry: model selection**

Azure AI Foundry hosts multiple models. The deployment name is set via the AZURE\_AI\_FOUNDRY\_DEPLOYMENT\_NAME environment variable so it can be changed without a code deploy. Evaluate the following models against cost and output quality on real mortgage case data before going live:

| Model | Azure tier | Strengths | Recommended for |
| :---- | :---- | :---- | :---- |
| GPT-4o | Pay-per-token (credits first) | Highest quality reasoning, strong structured JSON output, excellent professional prose | Primary recommendation for MVP if credits allow |
| GPT-4o mini | Pay-per-token (very low cost) | Good quality at \~15× lower cost than GPT-4o, reliable JSON mode | Cost-optimised production default once credits are exhausted |
| Phi-3 Medium (Azure) | Pay-per-token (very low cost) | Microsoft open model, strong for structured tasks, EU-hosted for data residency | Evaluate as lowest-cost fallback; test output quality against real cases |
| Phi-4 | Pay-per-token | Improved reasoning over Phi-3, instruction-following | Test as preferred open-model option for ongoing cost control |

| Model selection recommendation Start with GPT-4o (best output quality; Azure credits absorb cost). Once credits are consumed, switch to GPT-4o mini for day-to-day generation. Run a side-by-side evaluation of GPT-4o mini vs Phi-4 on 10 real cases before committing to the lowest-cost option. The AZURE\_AI\_FOUNDRY\_DEPLOYMENT\_NAME env var makes this a zero-code change. |
| :---- |

## **Prompt construction (lib/ai/buildReportPrompt.ts)**

| System prompt (fixed, all templates) You are an expert UK FCA-regulated mortgage compliance assistant. Generate a complete suitability report. Write in clear, professional British English. Never invent or assume facts not present in the data. Every section must include at least one Consumer Duty evidencing statement. Flag any section where data is insufficient. User prompt (constructed per case) Template: {templateType}. Client: {clientJSON}. Case: {caseJSON}. Products considered: {productsJSON}. Selected: {selectedProductJSON}. Adviser notes: {adviserNotes}. Vulnerable: {isVulnerable}. Generate all sections. Return ONLY valid JSON: { "sections": \[{ "id": string, "title": string, "content": string, "complianceFlag": "OK" | "REVIEW\_REQUIRED", "flagReason": string | null }\] } Azure AI Foundry call pattern (lib/ai/azureClient.ts) Use @azure/openai SDK (compatible with Azure AI Foundry endpoints). Initialise AzureOpenAI client with endpoint, apiKey, and apiVersion from env vars. Call client.chat.completions.create({ model: DEPLOYMENT\_NAME, response\_format: { type: "json\_object" }, messages: \[...\] }). The @azure/openai SDK uses the same interface as the OpenAI SDK — only the client initialisation differs. |
| :---- |

## **Per-section regeneration**

* POST /api/ai/regenerate-section: body { reportId, sectionId, adviserContext? }

* Sends only the specific section prompt with adviser context appended

* Response replaces only that section in SuitabilityReport.sections JSON

* Section status reset to not-approved after regeneration

## **Pre-finalisation compliance checks**

* All required sections for the template type are present and non-empty

* Each section content contains at least one Consumer Duty phrase (defined list in lib/ai/complianceCheck.ts — no AI call required for this check, it is a deterministic string scan)

* Minimum 3 ProductConsidered records exist for this case

* No placeholder text in any section: scan for "\[INSERT", "TBC", "N/A", "\[ADD"

* If client.isVulnerable: vulnerable customer overlay section is present

## **Report templates and required sections**

| Template | Required sections (in order) |
| :---- | :---- |
| Buy-to-let (BTL) | Client introduction • Property details • BTL affordability (ICR) • Product research & recommendation • Tax & investment considerations • Risks & Consumer Duty |
| First-time buyer (FTB) | Client introduction • Property details • Affordability assessment • Scheme eligibility (HTB/shared ownership) • Product research & recommendation • Risks & Consumer Duty |
| Remortgage | Client introduction • Existing mortgage summary • Remortgage rationale • Product research & recommendation • ERC analysis • Risks & Consumer Duty |
| Home mover | Client introduction • Property details • Porting vs. new mortgage analysis • Product research & recommendation • Risks & Consumer Duty |
| Product transfer | Client introduction • Existing product summary • Rate comparison • Recommendation rationale • Risks & Consumer Duty |
| Divorce/separation | Client introduction • Circumstances summary • Affordability on single income • Product research & recommendation • Legal note • Risks & Consumer Duty |
| Self-employed income | Client introduction (with trading history) • Income verification • Lender criteria assessment • Product research & recommendation • Risks & Consumer Duty |
| Vulnerable overlay | Vulnerability assessment summary • How vulnerability was considered • Additional Consumer Duty statement |

## **PDF generation**

* On report approval: server renders report sections to HTML using a branded template

* HTML-to-PDF via Puppeteer (serverless compatible on Vercel) or @react-pdf/renderer

* PDF uploaded to Cloudflare R2; signed URL stored in SuitabilityReport.pdfUrl

* PDF download available from case detail AI Report tab and from AI Reports screen

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Set up Azure AI Foundry resource in Azure portal; obtain endpoint \+ API key | **Backend Eng** | 1 hr | **P0** |
| Write lib/ai/azureClient.ts using @azure/openai SDK; test connectivity | **Backend Eng** | 2 hrs | **P0** |
| Implement POST /api/ai/generate-report with full prompt construction | **Backend Eng** | 4 hrs | **P0** |
| Implement POST /api/ai/regenerate-section | **Backend Eng** | 2 hrs | **P0** |
| Implement POST /api/ai/reports/\[id\]/approve (compliance check \+ PDF) | **Backend Eng** | 3 hrs | **P0** |
| Write lib/ai/buildReportPrompt.ts for all 8 templates | **Head of D\&E** | 3 hrs | **P0** |
| Write lib/ai/complianceCheck.ts (pre-finalisation deterministic scanner) | **Backend Eng** | 2 hrs | **P0** |
| Run model evaluation: GPT-4o vs GPT-4o mini vs Phi-4 on 5 seed cases; record output quality scores | **Head of D\&E** | 3 hrs | **P0** |
| Build AI Reports screen: template selector, data sources, product record | **UI/UX** | 5 hrs | **P0** |
| Build report sections UI: collapsible, edit, per-section regen, approve flow | **UI/UX** | 5 hrs | **P0** |
| Build generation animation (step labels via SSE or polling) | **Head of D\&E** | 2 hrs | P1 |
| Integrate PDF generation (Puppeteer or react-pdf) | **Backend Eng** | 3 hrs | P1 |
| Write snapshot tests for prompt builder with each template type | **Head of D\&E** | 2 hrs | P1 |

## **Acceptance Criteria**

* Azure AI Foundry endpoint reachable; /api/health returns AI: true with chosen deployment name

* Report generates successfully for all 8 template types from seed data using configured deployment

* Model evaluation completed; chosen model documented in /docs/ai-model-selection.md with cost estimates

* Sections contain no invented facts (validated manually against input data)

* Pre-finalisation check correctly flags missing Consumer Duty language

* Approved report produces a downloadable PDF with branded header

* Per-section regeneration updates only the target section; other sections unchanged

| PRD-10 Messages & Notifications (Resend \+ Twilio) Owner: Backend Eng \+ UI/UX    Phase: Sprint 3-4 |
| :---- |

## **Purpose**

Build the centralised 2-way messaging hub and all automated notification triggers. Messages are the communication spine of the platform: every client-facing update from any module (Compliance, AI Reports, Cases) flows through here.

## **Message hub (/dashboard/messages)**

* Two-panel layout: conversation list (300px fixed left, scrollable) and thread view (flex-1 right)

* Conversation list sorted by most recent message DESC

* Filter tabs: All, Inbound (client replies), Cases (outbound updates), System (compliance \+ AI)

* Each thread item: contact name, 60-char preview, timestamp, source badge (colour-coded), unread dot

* Active thread highlighted with teal-50 background

### **Thread view**

* Header: contact name, sub-label (case ref \+ type if applicable), source badge

* Message bubbles typed by direction and sourceType:

  * OUTBOUND from adviser: right-aligned, teal-700 background, white text

  * INBOUND from client: left-aligned, white card, border

  * SYSTEM compliance: centred, purple-lt background, shield prefix icon

  * SYSTEM AI report: centred, amber-lt background, robot prefix icon

* Reply textarea at bottom; enter or button sends; creates Message (direction: OUTBOUND, channel: EMAIL) and calls Resend

### **Inline messaging (other screens)**

Every screen that can generate a client communication has an inline bar. These all write a Message record and show it in the hub:

* Case detail Overview tab: send bar "Send update to {clientName}…"

* Case detail Compliance tab: send bar "Send compliance update…"

* Case detail Messages tab: full embedded thread

* Main compliance screen: send bar per case panel

* AI Reports screen: "Message client" button (post-approval)

* Client table: "Message" button per row

## **Automated notifications (system-generated messages)**

| Trigger | Channels | Message record created | Source badge |
| :---- | :---- | :---- | :---- |
| Compliance stage advance | Email \+ SMS | Yes (OUTBOUND \+ SYSTEM) | Compliance |
| AI report approved \+ finalised | Email (PDF attached) | Yes (OUTBOUND) | AI Report |
| DIP submitted (manual trigger by adviser) | Email \+ SMS | Yes (OUTBOUND) | Case update |
| Mortgage offer received (manual trigger) | Email \+ SMS | Yes (OUTBOUND) | Case update |
| Inbound client email received | In-app only (create Message) | Yes (INBOUND) | Inbound email |

### **Inbound email handling**

* Resend inbound webhook (or Mailgun/SendGrid as alternative): receives email to {caseRef}@mail.koplatform.co.uk

* Webhook handler parses sender, subject, body, creates Message (direction: INBOUND, channel: EMAIL)

* Unread badge updated in sidebar; thread item gets unread dot

* Note: for MVP, manual inbound matching via sender email is sufficient; full email threading is Phase 2

### **SMS notifications**

* Twilio used for SMS. All SMS triggered server-side from compliance stage advance and key case events.

* SMS content: short factual update with case reference and action required if any

* Client mobile number taken from Client.phone field

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Build /api/messages (GET list, POST create, PATCH read) | **Backend Eng** | 3 hrs | **P0** |
| Implement Resend email delivery in lib/notifications/email.ts | **Backend Eng** | 2 hrs | **P0** |
| Implement Twilio SMS delivery in lib/notifications/sms.ts | **Backend Eng** | 2 hrs | **P0** |
| Build notification trigger functions called by compliance \+ AI report handlers | **Backend Eng** | 3 hrs | **P0** |
| Build messages hub: conversation list with filter tabs | **UI/UX** | 4 hrs | **P0** |
| Build thread view: bubble types, reply input | **UI/UX** | 4 hrs | **P0** |
| Build inline message bars on all relevant screens | **UI/UX** | 3 hrs | P1 |
| Implement inbound email webhook handler (Resend) | **Backend Eng** | 3 hrs | P1 |
| Update sidebar unread badge dynamically (TanStack Query polling) | **Head of D\&E** | 2 hrs | P1 |

## **Acceptance Criteria**

* Sending a message from the thread view delivers an email via Resend (verifiable in Resend dashboard)

* Compliance stage advance triggers an email notification to the client email address

* System messages from compliance and AI report appear in the hub with correct source badges

* Unread badge in sidebar reflects count of unread messages; clears when thread is opened

| PRD-11 Calculators & Tools Owner: UI/UX Strategist \+ Tech PM    Phase: Sprint 3 |
| :---- |

## **Purpose**

Build all eight mortgage calculators as reactive, self-contained tools. Calculators are used daily by advisers during research and are accessible from the main nav.

## **Implementation rules**

* All formula logic in /lib/calculators/formulas.ts as pure exported functions — no side effects, no API calls

* Each calculator: react-hook-form with watch() for live reactivity; no submit button

* Results update on every keystroke / selection change

* "Copy result" copies formatted result to clipboard

* "Add to case note" (Phase 2 implementation; stub action in MVP)

* Calculators page (/dashboard/calculators): 2x4 grid of calculator selection cards \+ active calculator panel below

## **Calculator specifications**

| Calculator | Required inputs | Primary output | Formula |
| :---- | :---- | :---- | :---- |
| Affordability | Gross income, joint income, monthly commitments, multiplier (4× to 5.5×) | Max loan amount | (income \+ joint) × multiplier |
| Monthly payment | Loan amount, annual rate %, term (years), toggle: repayment / interest-only | Monthly payment | Amortisation for repayment; P×r/12 for I/O |
| Stamp duty | Purchase price, is FTB, is BTL | Total duty owed \+ breakdown by band | UK 2024 SDLT bands; \+3% BTL surcharge |
| LTV | Loan amount, property value | LTV percentage | (loan / value) × 100 |
| ERC | Outstanding balance, ERC rate % | Charge amount | balance × (ercRate / 100\) |
| Rental yield | Annual rent, property value, annual costs | Gross yield \+ net yield | Gross: rent/value; Net: (rent−costs)/value |
| Remortgage saving | Current rate, new rate, balance, term | Annual saving \+ total saving over term | Monthly payment diff via amortisation × 12 |
| Debt consolidation | Array of debts (balance \+ rate), new rate, new term | New monthly payment, monthly saving, total cost | Standard amortisation on consolidated balance |

### **Stamp duty bands (UK 2024, England)**

* Up to £250,000: 0% (FTB threshold £425,000)

* £250,001 to £925,000: 5%

* £925,001 to £1,500,000: 10%

* Above £1,500,000: 12%

* BTL / additional property: all bands \+3%

* FTB relief: 0% up to £425,000; 5% from £425,001 to £625,000; no FTB relief above £625,000

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Write and unit-test all 8 formula functions in formulas.ts | **Tech PM** | 4 hrs | **P0** |
| Build calculator grid selection UI | **UI/UX** | 2 hrs | **P0** |
| Build Affordability, Monthly Payment, LTV, ERC calculators | **UI/UX** | 4 hrs | **P0** |
| Build Stamp Duty calculator with all band logic and FTB/BTL toggles | **UI/UX** | 3 hrs | **P0** |
| Build Rental Yield, Remortgage Saving, Debt Consolidation calculators | **UI/UX** | 3 hrs | P1 |
| Implement "Copy result" clipboard action | **Head of D\&E** | 1 hr | P1 |
| 100% unit test coverage for all formula functions | **Tech PM** | 2 hrs | **P0** |

## **Acceptance Criteria**

* All 8 calculators render and produce correct results (validated manually)

* Results update live on every input change — no submit button needed

* Affordability: £72,000 income × 4.5 \= £324,000 max loan (verify exactly)

* Stamp duty: £500,000 purchase, not FTB, not BTL \= £12,500 (verify exactly)

* 100% unit test coverage on formulas.ts

| PRD-12 Settings, Billing & Plan Gating Owner: Backend Eng \+ Head of D\&E    Phase: Sprint 4 |
| :---- |

## **Purpose**

Build the settings section (organisation, team, billing, integrations), implement plan-based feature gating, and wire up Stripe for subscription management.

## **Settings page (/dashboard/settings)**

Four tabs: Organisation, Team, Billing, Integrations.

### **Organisation tab**

* Edit: org name, logo upload (to R2; displayed in sidebar), timezone

* Danger zone: delete organisation (requires typing org name; sends email confirmation)

### **Team tab**

* Table: name, email, role badge, status (active/invited), last active

* Invite by email: sends Clerk invitation; creates User record with role: ADVISER default

* Change role dropdown (ADMIN only): updates User.role

* Remove user (ADMIN only): deactivates User.isActive, revokes Clerk org membership

### **Billing tab**

* Current plan badge \+ feature list

* Upgrade plan button → Stripe Checkout (hosted page)

* Subscription status: active/trialling/cancelled, next billing date

* Cancel subscription: Stripe subscription cancellation at period end

* POST /api/webhooks/stripe: handle checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

### **Integrations tab**

* Cards for each integration: Onfido (ID/KYC), Experian (credit), TwentyCI (sourcing)

* Each card: connected/disconnected status, API key input (masked), test connection button

* Stored in Organisation.settings JSON field

## **Plan gating**

Feature access is enforced at both the API layer (createHandler config) and the UI layer (PlanGate component).

| PlanGate component usage \<PlanGate feature="ai\_reports" plan={org.plan}\>  {/\* premium content \*/}  \</PlanGate\> When plan does not include the feature: renders an upgrade prompt card in place of children. Never hides the screen entirely — always shows what the feature would look like, locked. |
| :---- |

| Feature key | Starter | Professional | Enterprise |
| :---- | :---- | :---- | :---- |
| core\_crm | ✓ | ✓ | ✓ |
| compliance\_engine | ✓ | ✓ | ✓ |
| calculators | ✓ | ✓ | ✓ |
| messages | ✗ | ✓ | ✓ |
| ai\_reports | ✗ | ✓ | ✓ |
| client\_portal | ✗ | ✓ | ✓ |
| lender\_api\_submissions | ✗ | ✗ | ✓ |
| custom\_domain | ✗ | ✗ | ✓ |

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Build settings page shell with 4 tabs | **UI/UX** | 2 hrs | **P0** |
| Build organisation settings form with logo upload | **UI/UX** | 3 hrs | **P0** |
| Build team management table with invite \+ role change | **Head of D\&E** | 4 hrs | **P0** |
| Wire up Stripe Checkout for plan upgrades | **Backend Eng** | 4 hrs | P1 |
| Implement Stripe webhook handler | **Backend Eng** | 2 hrs | P1 |
| Build PlanGate component \+ canAccess() utility | **Head of D\&E** | 2 hrs | **P0** |
| Enforce feature gating on all relevant API routes | **Backend Eng** | 2 hrs | **P0** |
| Build integrations tab with API key storage | **Backend Eng** | 3 hrs | P2 |

## **Acceptance Criteria**

* STARTER org cannot access /dashboard/messages; sees upgrade prompt

* PROFESSIONAL org can access all MVP features without restriction

* Stripe webhook correctly updates Organisation.plan on checkout completion

* Team invite sends Clerk invitation email and creates User record on acceptance

| PRD-13 Client Portal (Phase 2 Plan) Owner: Tech PM \+ UI/UX    Phase: Phase 2 — Sprint 6+ |
| :---- |

## **Purpose**

The Client Portal is a Phase 2 feature providing clients with their own read-only authenticated view of their case progress, documents, and messages. This PRD is a planning document only — no build in MVP.

| Phase 2 only. Not in MVP scope. This PRD exists so the team designs MVP data structures and routing with Phase 2 in mind. Do not build any client-facing pages in the MVP. However: (a) the Client model should include portalEnabled (boolean, default false) and portalAccessToken fields, and (b) the /app/(client-portal) route group should be created but return 404 in MVP. |
| :---- |

## **Planned functionality**

* Separate authenticated route group: /portal/\* (Clerk organisation-less auth, client identity only)

* Client views: case progress tracker (read-only pipeline), uploaded documents, received messages, pending actions

* Client can reply to adviser messages (adds INBOUND Message to the hub)

* Client can upload documents directly to their case (with document type selection)

* Push notifications for key milestones (DIP decision, offer received) via email \+ optional web push

* Mobile-first responsive design (clients primarily on phone)

## **MVP preparation tasks**

* Add portalEnabled: Boolean @default(false) to Client model in PRD-03 schema

* Add portalAccessToken: String? (unique) to Client model

* Create /apps/web/app/(client-portal) directory with a placeholder layout.tsx

* Document the portal URL pattern: /portal?token={accessToken} (magic link)

| PRD-14 DevOps, Docker & Deployment Infrastructure Owner: Head of Design & Engineering    Phase: Sprint 1 \+ Ongoing |
| :---- |

## **Purpose**

Establish the CI/CD pipeline, Docker configuration for local development parity, Vercel deployment, and production infrastructure. This PRD has Sprint 1 tasks (CI, Docker, Vercel setup) and ongoing tasks throughout the project.

## **Local development: Docker**

Docker Compose provides a local development environment with PostgreSQL and any future local services. Developers should be able to run the full stack locally without Supabase for offline development.

### **docker-compose.yml**

* Service: postgres (postgres:15-alpine). Port: 5432\. Volume: postgres-data.

* Service: app (Node 20, mounts /apps/web). Port: 3000\. Depends on postgres.

* Environment variables loaded from .env.local via env\_file directive.

* Command: pnpm dev in app container.

### **Dockerfile (production)**

* Multi-stage build: (1) deps stage – install pnpm \+ dependencies, (2) builder stage – prisma generate \+ next build, (3) runner stage – minimal Node 20 Alpine, copy .next/standalone.

* Output: standalone Next.js build for minimal container size.

* Target registry: GitHub Container Registry (ghcr.io) – free with GitHub account.

## **CI/CD: GitHub Actions**

| Pipeline: .github/workflows/ci.yml Triggers: push to any branch, PR to main Steps: (1) pnpm install, (2) prisma generate, (3) tsc \--noEmit, (4) eslint, (5) vitest run (unit tests), (6) build (pnpm build) Pipeline: .github/workflows/deploy.yml Triggers: merge to main only Steps: (1) CI steps above, (2) vercel deploy \--prod (via Vercel GitHub integration or CLI), (3) post deploy: prisma migrate deploy against production DB, (4) Slack/Discord notification (optional) |
| :---- |

## **Vercel deployment (primary)**

* Connect GitHub repo to Vercel. Auto-deploy main branch.

* Preview deployments on all PRs (Vercel free tier). Review app URL posted to PR automatically.

* Environment variables set in Vercel project dashboard; not committed to repo.

* Next.js output: default (not standalone) for Vercel. Standalone used for Docker only.

* Custom domain: configure after MVP validation. Requires Vercel Pro (£20/mo) for custom domain on Pro plan; free hobby domain \*.vercel.app is sufficient for MVP.

## **Azure services (active — AI Foundry \+ future scale)**

| Azure is active from day one for AI inference Azure AI Foundry is the primary AI service used in this project. Azure credits are applied to inference costs first. The following Azure services are in use or planned: NOW (MVP): Azure AI Foundry — model inference for suitability report generation. Set up in Azure portal, credentials in env vars. Covered by Azure credits. PHASE 2 (scale): Azure Container Apps — horizontal scaling for API. Azure Blob Storage — large file volumes beyond R2 free tier. Azure DevOps Pipelines — replace GitHub Actions at scale. OPTIONAL (staging): Azure Container Apps free tier (180 vCPU-seconds/month) is sufficient for a staging/demo environment if preferred over Vercel preview deployments. |
| :---- |

## **Database migrations in production**

* Prisma migrations managed in /packages/db/prisma/migrations/

* Production migration: prisma migrate deploy runs in deploy pipeline against DATABASE\_URL

* Never run prisma migrate dev against production

* For Supabase: use DIRECT\_URL for migrations (bypasses the connection pooler)

## **Monitoring & observability**

* Vercel Analytics (free): page views, web vitals, error rates

* /api/health endpoint: polled every 5 minutes by Vercel uptime monitoring or UptimeRobot (free tier)

* Production error logging: Sentry free tier (5,000 errors/month) – add in Sprint 4

* Database monitoring: Supabase dashboard (built-in; no additional tooling needed)

## **Task Assignments**

| Task | Owner | Est. effort | Priority |
| :---- | :---- | :---- | :---- |
| Create docker-compose.yml for local dev with postgres service | **Head of D\&E** | 2 hrs | **P0** |
| Create Dockerfile (multi-stage, production-ready) | **Head of D\&E** | 2 hrs | P1 |
| Set up GitHub Actions CI pipeline (typecheck, lint, test, build) | **Head of D\&E** | 2 hrs | **P0** |
| Provision Azure AI Foundry resource in Azure portal; set deployment \+ env vars in Vercel | **Backend Eng** | 2 hrs | **P0** |
| Connect Vercel project to GitHub repo; configure all env vars including Azure AI vars | **Head of D\&E** | 1 hr | **P0** |
| Set up Vercel preview deployments on PRs | **Head of D\&E** | 1 hr | P1 |
| Add deploy pipeline with prisma migrate deploy step | **Head of D\&E** | 2 hrs | P1 |
| Set up Sentry for error monitoring (Sprint 4\) | **Head of D\&E** | 1 hr | P2 |
| Document Azure AI Foundry setup and model swap process in /docs/azure-ai.md | **Backend Eng** | 1 hr | **P0** |
| Document deployment runbook in /docs/deployment.md | **Tech PM** | 2 hrs | P1 |

## **Acceptance Criteria**

* docker-compose up starts the app and postgres locally; app is functional

* Pushing to any branch triggers CI and reports pass/fail on the GitHub commit

* Merging to main triggers automatic Vercel production deployment

* Production deployment includes prisma migrate deploy; no manual DB steps

* /api/health returns 200 in production environment with DB: true and AI: true

* Azure AI Foundry endpoint reachable from production Vercel deployment; test call returns valid JSON

| SECTION B Team Allocation & Sprint Plan Roles, responsibilities, sprint schedule, and GitHub workflow |
| :---- |

# **B1. Team Structure**

This is a four-person delivery team reporting to the CEO/CPO. The Head of Design & Engineering is the technical lead and GitHub gatekeeper. All team members are expected to contribute code ("vibe code" approach — fast, prototype-quality first, refactor later).

| Role | Person | Reports to | GitHub access |
| :---- | :---- | :---- | :---- |
| Head of Design & Engineering | TBC | CEO/CPO | Maintainer (merge rights to main) |
| Technical Product Manager | TBC | CEO/CPO | Write (PRs only) |
| UI/UX Strategist | TBC | CEO/CPO | Write (PRs only) |
| Backend Software Engineer | TBC | CEO/CPO | Write (PRs only) |

## **Role responsibilities**

### **Head of Design & Engineering**

* Technical lead and architecture owner. Reviews and merges all PRs. Sets coding standards.

* Owns PRD-02 (architecture), PRD-14 (DevOps). Supports all other PRDs.

* Primary contact for CEO/CPO on build decisions. Raises blockers immediately.

* Can vibe-code UI and backend; responsible for quality across the stack.

### **Technical Product Manager**

* Owns feature specification and acceptance testing for each PRD.

* Writes and maintains /docs/ folder: PRD updates, sprint notes, meeting decisions.

* Primary author of CRM (PRD-06) and Compliance (PRD-07) feature code.

* Manages sprint board (GitHub Projects or Linear). Keeps PRD task statuses current.

* Can vibe-code Next.js pages and TanStack Query data hooks.

### **UI/UX Strategist**

* Owns the design system (PRD-01), all user-facing component builds, and UX review.

* Primary author of landing page, all dashboard page layouts, form components, and calculator UIs.

* Ensures prototype fidelity: every screen is measured against the v2a prototype before PR.

* Can vibe-code React components and Tailwind styling.

### **Backend Software Engineer**

* Owns database schema (PRD-03), authentication (PRD-04), API layer (PRD-05), and all complex business logic.

* Primary author of compliance engine, AI integration, and notification system.

* Writes unit and integration tests for all logic functions and API routes.

* Responsible for zero cross-tenant data leakage — owns data isolation.

## **CEO/CPO Oversight**

| Your role in the build process You are the product decision authority. You are not expected to write code, but you will: (1) review and approve each PRD before the relevant sprint begins, (2) attend sprint demos (end of each sprint, \~30 min), (3) unblock decisions on scope, design, or client-facing content within 24 hours of escalation, (4) review and approve the v2a prototype against client feedback, (5) manage client (KO Realtors) communication and sign-off. |
| :---- |

# **B2. Sprint Schedule**

Sprints are 2 weeks each. 12-week MVP \= 6 sprints. Head of D\&E runs a 30-minute daily standup async (Slack thread) and a 1-hour sprint demo \+ planning at the start of each new sprint.

| Sprint | Weeks | PRDs active | Primary deliverables | Demo milestone |
| :---- | :---- | :---- | :---- | :---- |
| S1 | 1–2 | 00–05, 14 | Monorepo, design system, landing page, DB, auth, API layer, Docker \+ Vercel CI | Landing page live on Vercel; /api/health 200; DB seeded |
| S2 | 3–4 | 06, 07, 08 | Client list, case kanban \+ table, case detail (Overview \+ Docs tabs), compliance stepper, fact-find Steps 1–4 | Full case created; fact-find Steps 1–4 complete; compliance stage advance works |
| S3 | 5–6 | 06 (cont), 07 (cont), 08 (cont), 11 | Case detail (Compliance \+ Messages \+ AI tabs), fact-find Steps 5–7, all 8 calculators | Full fact-find completable; calculators live; compliance audit trail working |
| S4 | 7–8 | 09, 10 | Azure AI Foundry integration \+ AI report generation (all 8 templates), model evaluation, messages hub, notifications (Resend \+ Twilio) | Azure AI Foundry connected; full report generated with chosen model, edited, approved, PDF exported; message hub live; emails delivered |
| S5 | 9–10 | 12, 14 (cont) | Settings (org, team, billing), plan gating, Stripe integration, Sentry, final DevOps | Plan gating enforced; Stripe upgrade flow works; all environments stable |
| S6 | 11–12 | All PRDs | Bug fix, polish, performance, KO Financials data migration, adviser training, go-live | KO Financials live on production; at least 2 advisers onboarded and using the platform |

# **B3. PRD-to-Role Assignment Matrix**

Primary owner is the person responsible for delivering the PRD. Supporting roles contribute tasks as listed in each PRD.

| PRD | Primary owner | Supporting | Estimated total effort |
| :---- | :---- | :---- | :---- |
| PRD-00 | Head of D\&E | All | 2 hrs (read \+ agree) |
| PRD-01 | UI/UX | Head of D\&E | 18 hrs UI \+ 3 hrs setup |
| PRD-02 | Head of D\&E | All | 8 hrs |
| PRD-03 | Backend Eng | Head of D\&E | 10 hrs |
| PRD-04 | Backend Eng | Head of D\&E | 10 hrs |
| PRD-05 | Backend Eng | Head of D\&E | 9 hrs |
| PRD-06 | Tech PM \+ UI/UX | Backend Eng | 28 hrs |
| PRD-07 | Backend Eng | Tech PM | 18 hrs |
| PRD-08 | UI/UX | Backend Eng | 24 hrs |
| PRD-09 | Head of D\&E \+ Backend Eng | UI/UX | 31 hrs (incl. Azure setup \+ model eval) |
| PRD-10 | Backend Eng | UI/UX | 22 hrs |
| PRD-11 | UI/UX | Tech PM | 18 hrs |
| PRD-12 | Backend Eng | Head of D\&E | 18 hrs |
| PRD-13 | Tech PM | UI/UX | 2 hrs (planning only) |
| PRD-14 | Head of D\&E | All | 10 hrs Sprint 1 \+ 2 hrs/sprint ongoing |
| **Total** |  |  | **208 hrs (across team of 4 over 12 weeks ≈ 4.3 hrs/person/day)** |

# **B4. GitHub Workflow**

All team members follow this workflow without exception. The Head of D\&E is the sole maintainer with merge rights to main.

### **Daily flow**

11. Pull latest main: git pull origin main

12. Create feature branch: git checkout \-b feature/PRD-06-case-kanban

13. Build the task. Commit frequently with descriptive messages: git commit \-m "feat(PRD-06): add kanban drag-and-drop"

14. Push branch and open PR. PR title format: \[PRD-06\] Add case kanban drag-and-drop

15. PR description must include: what changed, PRD section reference, how to test, any known issues

16. CI must pass. Fix any failures before requesting review.

17. Request review from Head of D\&E (required for all PRs)

18. Head of D\&E reviews: approves and merges, or requests changes with specific comments

19. After merge: delete branch, pull latest main on local

### **PR checklist (required before requesting review)**

| Every PR must confirm: ✓  tsc \--noEmit passes (no TypeScript errors) ✓  eslint passes (zero warnings) ✓  Unit tests pass (vitest run) ✓  Component tested at 375px and 1280px ✓  No console.error in browser on the affected screens ✓  PR description links to the PRD section being implemented ✓  No .env values committed to the repository |
| :---- |

### **Commit message convention**

* feat(PRD-XX): short description — new feature

* fix(PRD-XX): short description — bug fix

* chore(PRD-XX): short description — tooling, config, refactor

* test(PRD-XX): short description — tests only

* docs(PRD-XX): short description — documentation only

### **Conflict resolution**

* If PRs conflict: the developer whose PR was opened second is responsible for rebasing

* Rebase: git fetch origin && git rebase origin/main

* If conflict cannot be resolved in 30 minutes: escalate to Head of D\&E immediately

### **CEO/CPO visibility**

* GitHub Projects board (or Linear) is the source of truth for sprint progress. CEO/CPO has read access.

* Sprint demo recordings uploaded to shared drive within 24 hours of demo

* Blockers escalated to CEO/CPO via Slack DM within 4 hours of identification

Document prepared by Luxcity Technology  —  www.luxcity.tech  —  April 2026