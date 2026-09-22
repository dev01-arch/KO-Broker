# PRD-16 Build Tasks

## Case Journey, Book of Business & Lender Directory

| Field | Detail |
| :---- | :---- |
| **Document type** | Phased Build Task Tracker |
| **Linked plan** | PRD-16-Backend-Engineering-Plan.md |
| **PRD** | PRD-16 v1.0 — 15 September 2026 |
| **Process** | Complete each phase → await review → proceed on command |

---

## Phase Overview

| Phase | Workstreams | Focus | Gate |
| :---- | :---- | :---- | :---- |
| **Phase 1** | W0 | Schema, migrations, lender seed, GET /api/lenders, Zod types | Review before Phase 2 |
| **Phase 2** | W1 | Lender select on products — lenderId replaces free-text | Review before Phase 3 |
| **Phase 3** | W2 | Case Overview accordions — notes thread, date spine, account strip | Review before Phase 4 |
| **Phase 4** | W3 | Property model — client-owned, postcode at case create, Intel fill | Review before Phase 5 |
| **Phase 5** | W4 | Amend + stale recommendation — edit-in-place, audit, report protection | Review before Phase 6 |
| **Phase 6** | W5 | Request from client — info requests, auto-fulfil, compliance link | Review before Phase 7 |
| **Phase 7** | W6 | Radar counts, Cases filter, FCA cron / CSV fallback | Final review |

---

---

# Phase 1 — Foundation: Schema, Seed, and Lender API

**Workstream:** W0  
**Status:** PENDING — awaiting build command  
**Estimated effort:** ~13 hrs  
**Blocks:** Every subsequent phase depends on this.

**Goal:** Lay the database foundation. No UI changes. At the end of this phase, a Postman search for "Clydesdale" returns one row and a migration runs clean on a fresh database.

---

## Task 1.1 — Add new Prisma enums

**File:** `packages/db/prisma/schema.prisma`

Add the following enums:

```prisma
enum LenderStatus {
  ACTIVE
  INACTIVE
  LEGACY
}

enum LenderSource {
  SEED
  FCA
  OTHER
}

enum PropertyType {
  RESIDENTIAL
  BTL
  OTHER
}

enum CaseNoteSource {
  ADVISER
  INTEL
  SYSTEM
}

enum InfoRequestStatus {
  OUTSTANDING
  FULFILLED
  CANCELLED
}
```

**Done when:** `pnpm db:generate` passes with no type errors.

---

## Task 1.2 — Add Lender model

**File:** `packages/db/prisma/schema.prisma`

```prisma
model Lender {
  id             String       @id @default(cuid())
  name           String       @unique
  normalizedName String       @unique
  fcaFrn         String?
  status         LenderStatus @default(ACTIVE)
  source         LenderSource @default(SEED)
  lastSeenAt     DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  productsConsidered ProductConsidered[]
  cases              Case[]

  @@map("lenders")
}
```

**Done when:** Model is in schema, generator passes.

---

## Task 1.3 — Add Property model

**File:** `packages/db/prisma/schema.prisma`

```prisma
model Property {
  id           String       @id @default(cuid())
  orgId        String
  clientId     String
  address      Json?
  postcode     String
  tenure       String?
  type         PropertyType @default(RESIDENTIAL)
  currentValue Float?
  monthlyRent  Float?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  organisation Organisation @relation(fields: [orgId], references: [id])
  client       Client       @relation(fields: [clientId], references: [id])
  cases        Case[]

  @@map("properties")
}
```

Add relations to existing models:
- `Client` → add `properties Property[]`
- `Case` → add `property Property? @relation(fields: [propertyId], references: [id])`

**Done when:** Generator passes. Relations resolve correctly.

---

## Task 1.4 — Add CaseNote model

**File:** `packages/db/prisma/schema.prisma`

```prisma
model CaseNote {
  id           String         @id @default(cuid())
  orgId        String
  caseId       String
  body         String
  tag          String?
  authorUserId String?
  source       CaseNoteSource @default(ADVISER)
  createdAt    DateTime       @default(now())

  case   Case  @relation(fields: [caseId], references: [id])
  author User? @relation(fields: [authorUserId], references: [id])

  @@map("case_notes")
}
```

Add `notes CaseNote[]` to the `Case` model.

**Done when:** Generator passes.

---

## Task 1.5 — Add ClientInfoRequest model

**File:** `packages/db/prisma/schema.prisma`

```prisma
model ClientInfoRequest {
  id                  String            @id @default(cuid())
  orgId               String
  caseId              String
  clientId            String
  checklistItemId     String?
  documentType        String?
  messageId           String?
  status              InfoRequestStatus @default(OUTSTANDING)
  fulfilledDocumentId String?
  createdAt           DateTime          @default(now())
  fulfilledAt         DateTime?

  case   Case   @relation(fields: [caseId], references: [id])
  client Client @relation(fields: [clientId], references: [id])

  @@map("client_info_requests")
}
```

Add `infoRequests ClientInfoRequest[]` to both `Case` and `Client` models.

**Done when:** Generator passes.

---

## Task 1.6 — Add new nullable columns to Case

**File:** `packages/db/prisma/schema.prisma`

Add to the `Case` model (all nullable — zero impact on existing rows):

```prisma
// Property FK
propertyId    String?

// Date spine
aipAt         DateTime?
submittedAt   DateTime?
offerIssuedAt DateTime?
offerExpiresAt DateTime?
exchangeAt    DateTime?
completionAt  DateTime?

// Account strip
rateType      String?
monthlyPayment Float?
initialRateEndsAt DateTime?
chargeType    String?
isOffset      Boolean?

// Lender FK (additive alongside existing selectedLender string)
lenderId      String?
lenderOtherName String?

// Stale recommendation
recommendationStaleAt     DateTime?
recommendationStaleReason String?
```

**Done when:** Generator passes. Existing `selectedLender String?` column is NOT removed.

---

## Task 1.7 — Add new nullable columns to ProductConsidered

**File:** `packages/db/prisma/schema.prisma`

Add to `ProductConsidered` (all nullable):

```prisma
lenderId          String?
lenderOtherName   String?
productType       String?
initialTermMonths Int?
ercSummary        String?
```

Add relation: `lender Lender? @relation(fields: [lenderId], references: [id])`

**Done when:** Generator passes. Existing `lenderName String` is NOT removed.

---

## Task 1.8 — Run Prisma migration

**Command:** `pnpm --filter @ko/db db:migrate` (or the project's equivalent migrate command)

- Migration name: `prd16_w0_lender_property_casenote_inforequest`
- All new columns are nullable — migration is safe on live data.
- Verify `pnpm db:generate` produces updated types with no errors.

**Done when:** Migration file created, `pnpm typecheck` passes across the monorepo.

---

## Task 1.9 — Lender seed script

**File:** `packages/db/prisma/seed-lenders.ts` (new file)

- Reads all 190 names from Appendix A of PRD-16.
- Computes `normalizedName`: `name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()`
- Upserts each on `normalizedName` (idempotent — safe to re-run).
- Sets `status = LEGACY` for: Bradford & Bingley, Intelligent Finance, Mortgage Express, NRAM.
- Ensures the `Other` row exists: `{ name: 'Other', source: 'OTHER', status: 'ACTIVE' }`.
- Logs a summary: `Seeded X lenders (Y inserted, Z skipped)`.

Wire the script into the existing seed runner (check `packages/db/prisma/seed.ts` — add an import/call, or run standalone via `pnpm db:seed-lenders`).

**Done when:** Script runs to completion, `GET /api/lenders?q=clydes` (once the route exists in 1.11) returns `Clydesdale Bank PLC`.

---

## Task 1.10 — @ko/types: add new Zod schemas

**File:** `packages/types/src/index.ts`

Add the following schemas and export them:

```typescript
// New enums
export const LenderStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'LEGACY'])
export type LenderStatus = z.infer<typeof LenderStatusSchema>

export const LenderSourceSchema = z.enum(['SEED', 'FCA', 'OTHER'])
export type LenderSource = z.infer<typeof LenderSourceSchema>

export const PropertyTypeSchema = z.enum(['RESIDENTIAL', 'BTL', 'OTHER'])
export type PropertyType = z.infer<typeof PropertyTypeSchema>

export const CaseNoteSourceSchema = z.enum(['ADVISER', 'INTEL', 'SYSTEM'])
export type CaseNoteSource = z.infer<typeof CaseNoteSourceSchema>

export const InfoRequestStatusSchema = z.enum(['OUTSTANDING', 'FULFILLED', 'CANCELLED'])
export type InfoRequestStatus = z.infer<typeof InfoRequestStatusSchema>

// Lender query
export const LenderSearchQuerySchema = z.object({
  q: z.string().optional(),
})
export type LenderSearchQuery = z.infer<typeof LenderSearchQuerySchema>

// Case note
export const CreateCaseNoteSchema = z.object({
  body: z.string().min(1, 'Note body is required'),
  tag: z.string().optional(),
})
export type CreateCaseNoteInput = z.infer<typeof CreateCaseNoteSchema>

// Property
export const CreatePropertySchema = z.object({
  postcode: z.string().min(2, 'Postcode is required').max(10),
  address: z.record(z.string(), z.unknown()).optional(),
  tenure: z.string().optional(),
  type: PropertyTypeSchema.optional(),
  currentValue: z.number().positive().optional(),
  monthlyRent: z.number().nonnegative().optional(),
})
export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>

// Date spine + account strip (used in PATCH /api/cases/:id)
export const UpdateCaseDateSpineSchema = z.object({
  aipAt: z.string().datetime().optional().nullable(),
  submittedAt: z.string().datetime().optional().nullable(),
  offerIssuedAt: z.string().datetime().optional().nullable(),
  offerExpiresAt: z.string().datetime().optional().nullable(),
  exchangeAt: z.string().datetime().optional().nullable(),
  completionAt: z.string().datetime().optional().nullable(),
  rateType: z.string().optional().nullable(),
  monthlyPayment: z.number().optional().nullable(),
  initialRateEndsAt: z.string().datetime().optional().nullable(),
  chargeType: z.string().optional().nullable(),
  isOffset: z.boolean().optional().nullable(),
})
export type UpdateCaseDateSpineInput = z.infer<typeof UpdateCaseDateSpineSchema>

// Info request
export const CreateInfoRequestSchema = z.object({
  checklistItemId: z.string().optional(),
  documentType: z.string().optional(),
  body: z.string().optional(),
  channel: MessageChannelSchema.optional(),
})
export type CreateInfoRequestInput = z.infer<typeof CreateInfoRequestSchema>
```

Extend existing `UpdateCaseSchema` to merge in `UpdateCaseDateSpineSchema` fields.

**Done when:** `pnpm typecheck` passes across the monorepo.

---

## Task 1.11 — GET /api/lenders route

**New files:**
- `apps/web/app/api/lenders/route.ts`
- `apps/web/lib/api/lenders-data.ts`

**`lenders-data.ts`:**

```typescript
export async function searchLenders(q?: string) {
  return prisma.lender.findMany({
    where: {
      status: { not: 'INACTIVE' },
      ...(q && q.trim()
        ? { name: { contains: q.trim(), mode: 'insensitive' } }
        : {}),
    },
    orderBy: [
      { source: 'asc' },   // OTHER (sentinel) last
      { name: 'asc' },
    ],
    take: 20,
    select: { id: true, name: true, normalizedName: true, status: true, source: true },
  })
}
```

**`route.ts`:**
- `GET` only.
- Requires valid Clerk session (`requireAuth()`).
- Parses `?q=` query param via `LenderSearchQuerySchema`.
- Returns `{ success: true, data: lenders[] }` envelope consistent with other API routes.
- Appends the `Other` sentinel row last if not already in results (in case `take: 20` fills up before reaching it).

**Done when:** `GET /api/lenders?q=clydes` → `200 [{ name: "Clydesdale Bank PLC", ... }]`. `GET /api/lenders?q=natwest` → returns NatWest. INACTIVE rows do not appear. LEGACY rows do appear.

---

## Task 1.12 — FCA spike (research, not build)

**Owner:** Backend + Head of D&E  
**Time-box:** 2 hours  
**Output:** Write the decision under Section 7 — Decisions in `PRD-16-Backend-Engineering-Plan.md`.

Questions to answer:
- Does the FCA FS Register publish a bulk CSV/JSON of firms with permission to enter into a regulated mortgage contract?
- URL, format, update frequency.
- If yes: proceed with `GET /api/cron/lenders-fca` in Phase 7.
- If no: proceed with `POST /api/settings/lenders/import` CSV upload fallback in Phase 7.

**This task does not block Phase 1 sign-off. It must be resolved before Phase 7 begins.**

---

## Phase 1 Acceptance Criteria

All of the following must pass before Phase 2 begins:

- [ ] `pnpm db:migrate` runs clean on a fresh database — no errors
- [ ] `pnpm typecheck` passes across the entire monorepo
- [ ] `pnpm lint` passes
- [ ] Seed script runs to completion: `Seeded 190 lenders`
- [ ] `GET /api/lenders?q=clydes` → `{ data: [{ name: "Clydesdale Bank PLC" }] }`
- [ ] `GET /api/lenders?q=Other` → returns the Other sentinel row
- [ ] `GET /api/lenders` (no q) → returns up to 20 lenders, Other last
- [ ] An INACTIVE lender does NOT appear in search results
- [ ] A LEGACY lender (e.g. "Bradford & Bingley") DOES appear in search results
- [ ] Seed is idempotent — running it twice produces no duplicate rows
- [ ] All new columns on `Case` and `ProductConsidered` are confirmed nullable in the migration file
- [ ] No existing tests are broken

---

---

# Phase 2 — Lender Select on Products (W1)

**Status:** LOCKED — awaiting Phase 1 review  
**Estimated effort:** ~6 hrs  
**Depends on:** Phase 1 (Lender table + seed)

**Goal:** Products considered stop using a free-text lender name. Advisers pick from the seeded list. The `Other` escape hatch handles unknown lenders. Existing data continues to work via backward-compatible `lenderName` fallback.

Tasks covered: W1.1 – W1.4 from the engineering plan.

---

# Phase 3 — Case Overview: Notes Thread + Date Spine (W2)

**Status:** LOCKED — awaiting Phase 2 review  
**Estimated effort:** ~8 hrs  
**Depends on:** Phase 1 (CaseNote table + date fields on Case)

**Goal:** `Case.adviserNotes` (single string) is replaced by an append-only `CaseNote` thread. Date spine and account strip fields are writable via PATCH. Intel's copy-to-notes writes a CaseNote row. The GET case detail response includes `notes[]`.

Tasks covered: W2.1 – W2.4 from the engineering plan.

---

# Phase 4 — Property on Client + Postcode at Case Create (W3)

**Status:** LOCKED — awaiting Phase 3 review  
**Estimated effort:** ~7 hrs  
**Depends on:** Phase 1 (Property table + Case.propertyId)

**Goal:** Property becomes a first-class record owned by the client. New cases capture postcode up front. Mortgage Intel's preview reads `Property.postcode` instead of re-asking. Best-effort backfill migrates existing `FactFind.propertyDetails` blobs.

Tasks covered: W3.1 – W3.4 from the engineering plan.

---

# Phase 5 — Amend + Stale Recommendation (W4)

**Status:** LOCKED — awaiting Phase 4 review  
**Estimated effort:** ~10 hrs  
**Depends on:** Phase 2 (lenderId on products), Phase 3 (notes thread for stale notes), Phase 4 (propertyId FK for stale trigger)

**Goal:** Changing a qualifying fact after a product is selected marks the recommendation stale, drops non-finalised reports back to DRAFT, and writes a CaseNote. A completed fact-find can be amended with an explicit audit trail. Re-selecting a product clears the stale flag. FINALISED reports are never touched.

Tasks covered: W4.1 – W4.6 from the engineering plan.

---

# Phase 6 — Request from Client (W5)

**Status:** LOCKED — awaiting Phase 5 review  
**Estimated effort:** ~7 hrs  
**Depends on:** Phase 1 (ClientInfoRequest table), messages system (PRD-10, already live)

**Goal:** Advisers can request a specific document or checklist item from a client directly from the compliance panel or document row. The request goes through the existing message system (email/SMS/portal). The item stays outstanding in Compliance until a matching document is uploaded or the adviser marks it complete.

Tasks covered: W5.1 – W5.5 from the engineering plan.

---

# Phase 7 — Radar + FCA Sync (W6)

**Status:** LOCKED — awaiting Phase 6 review  
**Estimated effort:** ~10 hrs  
**Depends on:** Phase 3 (date spine fields on Case), Phase 1 (Lender table for FCA cron), FCA spike decision

**Goal:** Dashboard bootstrap includes two radar counts (offers ending in 14 days, rate periods ending in 90 days). Cases list accepts date-based filters. FCA cron (or Settings CSV fallback) appends new lender names and marks departed ones INACTIVE.

Tasks covered: W6.1 – W6.4 from the engineering plan.

---

---

## Build Rules (apply to every phase)

1. **No phase starts without an explicit command.** This document is a plan, not a trigger.
2. **One PR per phase.** Branch name format: `feature/PRD-16-phase-{n}-{short-description}`.
3. **`pnpm typecheck` and `pnpm lint` must pass** at the end of every phase before it is presented for review.
4. **All new columns are nullable at migration time.** No existing data is mutated without a dedicated backfill step.
5. **INSERT-ONLY tables** (`CaseNote`, `AuditLog`): no UPDATE or DELETE routes, ever.
6. **Every mutation calls `logAuditEvent`.** No exceptions.
7. **No new top-level API route groups** that imply a nav item (no `/api/mortgages`, `/api/properties` as top-level, no `/api/tasks`).
8. **Backward compatibility:** Free-text `lenderName` and `selectedLender` string fields stay readable until the migration in Phase 2 writes `lenderId`. They are never deleted in Phase 1.
9. **devStore fallback** pattern must be followed in every new data function.
