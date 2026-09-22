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

**Workstream:** W1  
**Status:** COMPLETE  
**Estimated effort:** ~6 hrs  
**Depends on:** Phase 1 (Lender table + seed)  
**Commit:** Phase 2 commit (see git log)

**Goal:** Products considered stop using a free-text lender name. Advisers pick from the seeded list. The `Other` escape hatch handles unknown lenders. Existing data continues to work via backward-compatible `lenderName` fallback.

---

## Tasks Completed

### Task 2.1 — Code review and mapping ✓
Read `products-data.ts`, both product routes, `cases-data.ts`, and `UpdateCaseSchema`. Key findings:
- `createProductForCase` was writing `lenderName` directly from free-text input
- `updateCaseForOrg` was using `...input` spread — unsafe for new fields
- `serializeProductConsidered` did not expose PRD-16 fields
- Routes used `requireApiAuth` pattern (not `createHandler`) — no change needed there

### Task 2.2 — Extend Zod schemas in @ko/types ✓
**File:** `packages/types/src/index.ts`

`CreateProductConsideredSchema`:
- `lenderName` changed from required to optional (backward compat)
- Added: `lenderId?`, `lenderOtherName?`, `productType?`, `initialTermMonths?`, `ercSummary?`
- `superRefine` validation: at least one of `lenderId` or `lenderName` is required

`UpdateProductConsideredSchema`:
- Same new fields added as nullable optionals

`SaveProductsSchema` (bulk sync):
- `lenderName` made optional
- Same PRD-16 fields added

`UpdateCaseSchema` (extended in Phase 1):
- Already contained all PRD-16 fields; now fully consumed by `updateCaseForOrg`

### Task 2.3 — Update createProductForCase ✓
**File:** `apps/web/lib/api/products-data.ts`

New `resolveLenderName()` helper:
- Accepts `lenderId`, `lenderOtherName`, `lenderNameFallback`
- If `lenderId` supplied: fetches `Lender` row, uses `Lender.name` as display name
- If `lenderId` refers to `Other` sentinel (`source = 'OTHER'`): uses `lenderOtherName` as display name
- If only `lenderNameFallback`: uses as-is, `lenderId` stays null
- Returns null on invalid `lenderId` (triggers `VALIDATION_ERROR`)

`createProductForCase` changes:
- Calls `resolveLenderName()` before the transaction
- Writes `lenderId`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary` on create
- On product selection: syncs `Case.lenderId` + `Case.lenderOtherName` alongside legacy `selectedLender` string

### Task 2.4 — Update updateProductForCase ✓
**File:** `apps/web/lib/api/products-data.ts`

`updateProductForCase` changes:
- Detects if lender is being changed (`input.lenderId !== undefined || input.lenderName !== undefined`)
- Calls `resolveLenderName()` only when lender is changing — avoids unnecessary DB lookup
- All PRD-16 fields conditionally patched
- On selection: syncs `Case.lenderId` + `Case.lenderOtherName`
- On deselect: clears `Case.lenderId` + `Case.lenderOtherName`

`deleteProductForCase` changes:
- Clears `Case.lenderId` + `Case.lenderOtherName` when selected product is deleted

`serializeProductConsidered` extended:
- Now returns `lenderId`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary` in API response

### Task 2.5 — Update product routes ✓
**Files:** `apps/web/app/api/cases/[id]/products/route.ts` and `[productId]/route.ts`

Both routes updated to handle new `VALIDATION_ERROR` return code from the data layer (returns HTTP 422 with message). No other logic changes needed — `parsed.data` already flows straight through to the data functions.

### Task 2.6 — Extend updateCaseForOrg ✓
**File:** `apps/web/lib/api/cases-data.ts`

Replaced the `...input` spread with explicit field-by-field data object to:
- Prevent accidental writes of unknown fields to the DB
- Allow ISO date string → `Date` conversion via `toDate()` helper
- Safely include all 16 PRD-16 fields: `propertyId`, `lenderId`, `lenderOtherName`, date spine (6 fields), account strip (5 fields)

### Task 2.7 — Typecheck + lint ✓
- `tsc --noEmit` → exit 0, zero errors
- `eslint` → exit 0, zero errors (one pre-existing warning in dev-store.ts line 417 unrelated to Phase 2)
- Fixed: `dev-store.ts` lenderName fallback (`lenderName ?? lenderOtherName ?? 'Other'`) to handle now-optional field

---

## Files Modified in Phase 2

| File | Change type |
| :---- | :---- |
| `packages/types/src/index.ts` | Extended `CreateProductConsideredSchema`, `UpdateProductConsideredSchema`, `SaveProductsSchema` |
| `apps/web/lib/api/products-data.ts` | Rewrote create/update/delete/serialise with lenderId support |
| `apps/web/lib/api/cases-data.ts` | Extended `updateCaseForOrg` with all PRD-16 Case fields |
| `apps/web/app/api/cases/[id]/products/route.ts` | Added VALIDATION_ERROR handling |
| `apps/web/app/api/cases/[id]/products/[productId]/route.ts` | Added VALIDATION_ERROR handling |
| `apps/web/lib/api/dev-store.ts` | Fixed lenderName optional field fallback |

---

## Test Guide

See `Doc/PRD-16-Phase2-Test-Guide.md` for full test commands and acceptance checklist.

---

# Phase 3 — Case Overview: Notes Thread + Date Spine (W2)

**Workstream:** W2  
**Status:** COMPLETE  
**Estimated effort:** ~8 hrs  
**Depends on:** Phase 1 (CaseNote table + date fields on Case)  
**Commit:** Phase 3 commit (see git log)

**Goal:** `Case.adviserNotes` (single overwriting string) replaced by an append-only `CaseNote` thread. Date spine and account strip fields writable via PATCH. Intel copy-to-notes writes a CaseNote row. GET case detail response includes `notes[]`.

---

## Tasks Completed

### Task 3.1 — Code review and mapping ✓
Read `getCaseForOrg`, `serializeCaseDetail`, `cases.ts` serialiser, and the intelligence `copy-to-notes` route. Key findings:
- `getCaseForOrg` uses Prisma `include` — easy to add `notes` relation
- `serializeCaseDetail` has an explicit typed input — needs `notes[]` added to type and output
- `copy-to-notes` appended to `Case.adviserNotes` string via `prisma.case.update` — needs replacing with `prisma.caseNote.create`
- No `/api/cases/:id/notes` route existed

### Task 3.2 — notes-data.ts + GET/POST /api/cases/:id/notes ✓
**New files:**
- `apps/web/lib/api/notes-data.ts`
- `apps/web/app/api/cases/[id]/notes/route.ts`

`notes-data.ts` exports:
- `serializeCaseNote()` — serialises a note row including optional author
- `listNotesForCase()` — returns all notes ordered `createdAt asc`, with author joined
- `createNoteForCase()` — INSERT-ONLY, calls `logAuditEvent { action: CASE_NOTE_ADDED }`

Route exports `GET` and `POST` only. No `DELETE`, no `PATCH`. Follows `requireApiAuth` pattern. `POST` validates against `CreateCaseNoteSchema`, returns HTTP 201.

### Task 3.3 — Extend getCaseForOrg ✓
**File:** `apps/web/lib/api/cases-data.ts`

Added to the Prisma `include`:
```typescript
notes: {
  orderBy: { createdAt: 'asc' },
  include: { author: { select: { id, firstName, lastName } } },
}
```

### Task 3.4 — Extend serializeCaseDetail ✓
**File:** `apps/web/lib/api/cases.ts`

- Added `notes[]` type to the input parameter (optional array of CaseNote with author)
- Also added PRD-16 W1 product fields (`lenderId`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary`) to `productsConsidered` type and serialisation
- Notes serialised as `{ id, caseId, body, tag, source, authorUserId, author, createdAt }` with ISO timestamp

### Task 3.5 — Update copy-to-notes ✓
**File:** `apps/web/app/api/intelligence/snapshots/[id]/copy-to-notes/route.ts`

Replaced `prisma.case.update({ data: { adviserNotes: updatedNotes } })` with:
```typescript
await prisma.caseNote.create({
  data: { orgId, caseId, body: j4Block, tag: 'intel', source: 'INTEL', authorUserId }
});
```
`Case.adviserNotes` is no longer written by this route.

### Task 3.6 — adviserNotes backfill migration ✓
**New files:** `packages/db/prisma/migrate-adviser-notes.ts`

Script logic:
1. Finds all cases where `adviserNotes` is non-empty
2. For each: checks if a `CaseNote { source: ADVISER }` already exists (idempotency)
3. If not: inserts `CaseNote { source: ADVISER, authorUserId: null, createdAt: case.updatedAt }`
4. Does NOT clear `Case.adviserNotes`

**Ran against live DB:** 10 cases migrated, 0 errors. Second run: `Inserted: 0, Skipped: 10`.

Added `migrate:adviser-notes` script to `packages/db/package.json`.

### Task 3.7 — Typecheck + lint ✓
- `tsc --noEmit` → exit 0, zero errors
- `eslint` → exit 0, zero errors

---

## Files Modified in Phase 3

| File | Change type |
| :---- | :---- |
| `apps/web/lib/api/notes-data.ts` | New — notes data layer (INSERT-ONLY) |
| `apps/web/app/api/cases/[id]/notes/route.ts` | New — GET/POST notes route |
| `apps/web/lib/api/cases-data.ts` | Extended `getCaseForOrg` with notes include |
| `apps/web/lib/api/cases.ts` | Extended `serializeCaseDetail` with notes[] and PRD-16 W1 product fields |
| `apps/web/app/api/intelligence/snapshots/[id]/copy-to-notes/route.ts` | Rewrote to write CaseNote instead of Case.adviserNotes |
| `packages/db/prisma/migrate-adviser-notes.ts` | New — backfill migration script |
| `packages/db/package.json` | Added `migrate:adviser-notes` script |

---

## Test Guide

See `Doc/PRD-16-Phase3-Test-Guide.md`.

---

# Phase 4 — Property on Client + Postcode at Case Create (W3)

**Workstream:** W3
**Status:** COMPLETE
**Estimated effort:** ~7 hrs
**Depends on:** Phase 1 (Property table + Case.propertyId)
**Commit:** Phase 4 commit (see git log)

**Goal:** Property becomes a first-class record owned by the client. New cases capture postcode up front. Mortgage Intel's preview reads `Property.postcode` instead of re-asking. Best-effort backfill migrates existing `FactFind.propertyDetails` blobs.

---

## Tasks Completed

### Task 4.1 — Code review and mapping ✓
Key findings:
- `GET /api/clients/:id` uses `createParamHandler` with an inline Prisma query (not `getClientForOrg`) — `properties` include must be added directly there
- `POST /api/cases` route uses `createHandler` with inline `prisma.case.create` — property logic inserted before the create
- `assembleCasePreview` reads `factFind.propertyDetails` JSON blob — needs to check `case.property.postcode` first
- `CreateCaseSchema` had no postcode/propertyId fields
- `CasePreviewResponse` already had `postcode: PresenceField<string>` — no types change needed

### Task 4.2 — properties-data.ts ✓
**New file:** `apps/web/lib/api/properties-data.ts`

Exports:
- `serializeProperty()` — serialises a Property row with ISO timestamps
- `listPropertiesForClient()` — org+client scoped, ordered `createdAt desc`
- `createPropertyForClient()` — creates Property, fires `logAuditEvent { action: PROPERTY_CREATED }`
- `getPropertyById()` — org-scoped single lookup (used by case create validation)

### Task 4.3 — GET/POST /api/clients/:id/properties ✓
**New file:** `apps/web/app/api/clients/[id]/properties/route.ts`

- `GET` returns all properties for the client
- `POST` validates `CreatePropertySchema`, returns HTTP 201
- Follows `requireApiAuth` + `responses.ts` pattern

### Task 4.4 — Extend POST /api/cases ✓
**File:** `apps/web/app/api/cases/route.ts`

`CreateCaseSchema` extended in `@ko/types`:
- `postcode: z.string().min(2).max(10).transform(toUpperCase).optional()`
- `propertyId: z.string().optional()`

Route logic added before `prisma.case.create`:
1. If `propertyId` → validate it belongs to `clientId + orgId`, 404 if not
2. Else if `postcode` → auto-create `Property { postcode, type: RESIDENTIAL, currentValue }`, capture `id`
3. `prisma.case.create` now passes `propertyId: resolvedPropertyId`
4. `propertyId` included in audit diff

### Task 4.5 — GET /api/clients/:id includes properties[] ✓
**File:** `apps/web/app/api/clients/[id]/route.ts`

Added to the Prisma `include`:
```typescript
properties: {
  orderBy: { createdAt: 'desc' },
  select: { id, postcode, address, type, tenure, currentValue, monthlyRent, createdAt, updatedAt }
}
```

### Task 4.6 — Intel preview reads Property.postcode first ✓
**File:** `apps/web/lib/intelligence/case-preview.ts`

Added `property: { select: { postcode: true } }` to `prisma.case.findFirst` include.

Postcode resolution priority:
1. `caseRow.property?.postcode` (new Property row)
2. `extractPostcode(personalDetails, client.address)` (existing JSON fallback)

### Task 4.7 — FactFind propertyDetails backfill ✓
**New file:** `packages/db/prisma/migrate-property-backfill.ts`

- Tries 3 postcode extraction paths: direct `pd.postcode`, `pd.address.postcode`, `pd.currentAddress.postcode`
- Creates Property + links `Case.propertyId` in a transaction
- Per-row error handling — never fails the whole migration
- **Ran on live DB:** 53 cases checked, 0 errors, 53 skipped (demo data has no postcode in blobs), 0 inserted
- Second run confirmed idempotent

Added `migrate:property-backfill` script to `packages/db/package.json`.

### Task 4.8 — Typecheck + lint ✓
- Fixed: `address: input.address ?? undefined` → `address: (input.address as object) ?? undefined` (Prisma `InputJsonValue` compatibility)
- `tsc --noEmit` → exit 0
- `eslint` → exit 0

---

## Files Modified in Phase 4

| File | Change type |
| :---- | :---- |
| `apps/web/lib/api/properties-data.ts` | New — property data layer |
| `apps/web/app/api/clients/[id]/properties/route.ts` | New — GET/POST properties route |
| `apps/web/app/api/clients/[id]/route.ts` | Added `properties[]` to client detail include |
| `apps/web/app/api/cases/route.ts` | POST extended with postcode/propertyId logic |
| `apps/web/lib/intelligence/case-preview.ts` | Reads Property.postcode first |
| `packages/db/prisma/migrate-property-backfill.ts` | New — backfill migration |
| `packages/db/package.json` | Added `migrate:property-backfill` script |
| `packages/types/src/index.ts` | `CreateCaseSchema` extended with postcode + propertyId |

---

## Test Guide

See `Doc/PRD-16-Phase4-Test-Guide.md`.

---

# Phase 5 — Amend + Stale Recommendation (W4)

**Workstream:** W4
**Status:** COMPLETE
**Estimated effort:** ~10 hrs
**Depends on:** Phase 2 (lenderId on products), Phase 3 (notes thread), Phase 4 (propertyId FK)
**Commit:** Phase 5 commit (see git log)

**Goal:** Changing a qualifying fact after a product is selected marks the recommendation stale, drops non-finalised reports back to DRAFT, and writes a SYSTEM CaseNote. A completed fact-find can be amended with an explicit audit trail. Re-selecting a product clears the stale flag. FINALISED reports are never touched.

---

## Tasks Completed

### Task 5.1 — Code review and mapping ✓
Key findings:
- `updateCaseForOrg` spreads input directly — needed to snapshot existing fields first
- `upsertFactFindWithCompliance` had a hard `FORBIDDEN` guard on completed fact-finds — needed `isAmend` flag as a separate bypass path
- `createProductForCase` / `updateProductForCase` both run `$transaction` — stale clear fits inside them
- FINALISED protection already existed in `approveAiReportForOrg` and `regenerateSection` — no changes needed

### Task 5.2 — lib/compliance/stale.ts ✓
**New file:** `apps/web/lib/compliance/stale.ts`

`checkAndSetRecommendationStale`:
1. Checks `hasSelected` via `productConsidered.count({ isSelected: true })` — skips if 0
2. Sets `recommendationStaleAt` + `recommendationStaleReason` on Case
3. `updateMany` on SuitabilityReport with `status: { in: ['DRAFT', 'ADVISER_REVIEW'] }` → sets to `DRAFT`. `APPROVED` and `FINALISED` excluded.
4. Writes SYSTEM CaseNote `tag: amend` — only on first stale set (idempotent on re-trigger)
5. Fires `logAuditEvent { action: RECOMMENDATION_STALE }` fire-and-forget
6. Accepts optional `TxClient` to participate in caller's transaction

`clearRecommendationStale`:
1. Checks `wasStale` from DB — no-op if not stale
2. Clears `recommendationStaleAt` + `recommendationStaleReason`
3. Writes SYSTEM CaseNote `tag: amend` body "stale flag cleared"
4. Fires `logAuditEvent { action: RECOMMENDATION_STALE_CLEARED }`
5. Also accepts optional `TxClient`

### Task 5.3 — Hook stale into updateCaseForOrg ✓
**File:** `apps/web/lib/api/cases-data.ts`

- Snapshot now selects `loanAmount`, `propertyValue`, `termYears`, `propertyId` before the update
- After `prisma.case.update`, compares each against `input.*`
- If any changed: calls `checkAndSetRecommendationStale` fire-and-forget
- Added `options?: { userId? }` param so stale events are attributed to the adviser
- PATCH route updated to pass `{ userId: authResult.user?.id }`

### Task 5.4 — isAmend flag + stale in upsertFactFindWithCompliance ✓
**Files:** `packages/types/src/index.ts`, `apps/web/lib/api/fact-find-data.ts`

Schema change: `UpsertFactFindSchema` gets `isAmend: z.boolean().optional()`

`upsertFactFindWithCompliance` logic:
- `isAmend=true` bypasses the `FORBIDDEN` completedAt guard (separate from `allowWhenComplete`)
- Audit action: `isAmend + factFindComplete` → `FACT_FIND_AMENDED`; `markComplete` → `FACT_FIND_COMPLETED`; else → `FACT_FIND_UPDATED`
- `STALE_SECTIONS = { incomeDetails, expenditureDetails, propertyDetails, existingMortgages }`
- On amend of any qualifying section → `checkAndSetRecommendationStale` fire-and-forget
- `isAmend` stripped from `sectionData` before DB write (alongside `markComplete`)
- `completePortalFactFind` unchanged — portal completion is not an amend

### Task 5.5 — Stale clear in product selection ✓
**File:** `apps/web/lib/api/products-data.ts`

- `clearRecommendationStale` imported
- Called inside `$transaction` in both `createProductForCase` and `updateProductForCase` after `Case.update` when `isSelected=true`
- Passes `tx` so it runs atomically with the product sync
- If case was stale: clears flag, writes SYSTEM CaseNote, fires audit event

### Task 5.6 — FINALISED report protection verified ✓
No code changes. Three existing protection points confirmed:
1. `approveAiReportForOrg` — explicit `if status === FINALISED` guard → `BUSINESS_RULE_VIOLATION`
2. `regenerateSection` — same guard
3. `checkAndSetRecommendationStale` — `updateMany` filter `status: { in: ['DRAFT', 'ADVISER_REVIEW'] }` — APPROVED + FINALISED never in the list

### Task 5.7 — Typecheck + lint ✓
- `tsc --noEmit` → exit 0
- `eslint` → exit 0
- Fixed: `eslint-disable-next-line` on `isAmend: _isAmend` destructure in `fact-find-data.ts`

---

## Files Modified in Phase 5

| File | Change type |
| :---- | :---- |
| `apps/web/lib/compliance/stale.ts` | New — stale detection + clear functions |
| `apps/web/lib/api/cases-data.ts` | Stale hook in `updateCaseForOrg`; options.userId param |
| `apps/web/app/api/cases/[id]/route.ts` | Passes userId to `updateCaseForOrg` |
| `apps/web/lib/api/fact-find-data.ts` | `isAmend` bypass + stale hook on qualifying sections |
| `apps/web/lib/api/products-data.ts` | `clearRecommendationStale` in product selection transactions |
| `packages/types/src/index.ts` | `isAmend` field on `UpsertFactFindSchema` |

---

## Test Guide

See `Doc/PRD-16-Phase5-Test-Guide.md`.

---

# Phase 6 — Request from Client (W5)

**Workstream:** W5
**Status:** COMPLETE
**Estimated effort:** ~7 hrs
**Depends on:** Phase 1 (ClientInfoRequest table), messages system (PRD-10, already live)
**Commit:** Phase 6 commit (see git log)

**Goal:** Advisers can request a specific document or checklist item from a client directly from the compliance panel or document row. The request goes through the existing message system (email/SMS/portal). The item stays outstanding in Compliance until a matching document is uploaded or the adviser marks it complete.

---

## Tasks Completed

### Task 6.1 — Code review and mapping ✓
Key findings:
- `POST /api/documents` creates document then logs audit — fulfil hook added after `document.create`
- `completeComplianceItemForOrg` creates `ComplianceRecord` then refreshes compliance — fulfil hook added after the create
- `broadcastMessageForOrg` handles all channels (email/SMS/portal/digest) — correct function to use
- `getCaseForOrg` uses Prisma `include` — `infoRequests` relation added with `status: OUTSTANDING` filter
- No existing `/api/cases/:id/info-requests` route

### Task 6.2 — info-requests-data.ts ✓
**New file:** `apps/web/lib/api/info-requests-data.ts`

`createInfoRequestForCase`: Loads case + client, builds pre-filled message body, calls `broadcastMessageForOrg`, creates `ClientInfoRequest { status: OUTSTANDING }`, `logAuditEvent { action: INFO_REQUEST_CREATED }`. Returns `{ infoRequest, message, delivery }`.

`fulfilInfoRequestsForDocument`: Matches `{ caseId, orgId, status: OUTSTANDING, documentType }`, `updateMany FULFILLED + fulfilledDocumentId + fulfilledAt`, audit fire-and-forget.

`fulfilInfoRequestsForChecklistItem`: Matches `{ caseId, orgId, status: OUTSTANDING, checklistItemId }`, `updateMany FULFILLED + fulfilledAt`, audit fire-and-forget.

### Task 6.3 — GET/POST /api/cases/:id/info-requests ✓
**New file:** `apps/web/app/api/cases/[id]/info-requests/route.ts`

GET + POST only. No PATCH or DELETE. `CreateInfoRequestSchema` validation (either `documentType` or `checklistItemId` required). HTTP 201 with `{ infoRequest, delivery }`.

### Task 6.4 — Auto-fulfil on document upload ✓
**File:** `apps/web/app/api/documents/route.ts`

Dynamic import of `fulfilInfoRequestsForDocument`, called `void` after `document.create` when `caseId` present.

### Task 6.5 — Fulfil on compliance item completion ✓
**File:** `apps/web/lib/api/compliance-overview-data.ts`

Dynamic import of `fulfilInfoRequestsForChecklistItem`, called `void` after `complianceRecord.create` inside `completeComplianceItemForOrg`.

### Task 6.6 — GET /api/cases/:id includes infoRequests[] ✓
`getCaseForOrg`: `infoRequests` include with `status: OUTSTANDING` filter. `serializeCaseDetail`: `infoRequests[]` type and output added.

### Task 6.7 — Typecheck + lint ✓
- `tsc --noEmit` → exit 0, zero errors
- `eslint` → exit 0, zero warnings

---

## Files Modified in Phase 6

| File | Change type |
| :---- | :---- |
| `apps/web/lib/api/info-requests-data.ts` | New — info request data layer |
| `apps/web/app/api/cases/[id]/info-requests/route.ts` | New — GET/POST route |
| `apps/web/app/api/documents/route.ts` | Added auto-fulfil after document create |
| `apps/web/lib/api/compliance-overview-data.ts` | Added fulfil after checklist item completion |
| `apps/web/lib/api/cases-data.ts` | Added infoRequests include to getCaseForOrg |
| `apps/web/lib/api/cases.ts` | Added infoRequests[] to serializeCaseDetail |

---

## Test Guide

See `Doc/PRD-16-Phase6-Test-Guide.md`.

---

# Phase 7 — Radar + FCA Sync (W6)

**Workstream:** W6
**Status:** COMPLETE
**Estimated effort:** ~10 hrs
**Depends on:** Phase 3 (date spine fields on Case), Phase 1 (Lender table for FCA cron), FCA spike decision
**Commit:** Phase 7 commit (see git log)

**Goal:** Dashboard bootstrap includes two radar counts (offers ending in 14 days, rate periods ending in 90 days). Cases list accepts date-based filters. FCA cron route is registered and auth-protected (501 stub until W0 spike decision is recorded).

---

## Tasks Completed

### Task 7.1 — Code review and mapping ✓
Key findings:
- `getDashboardBootstrap` uses a single `Promise.all` — two new `prisma.case.count` queries added in the same batch
- `GET /api/cases` uses an inline `prisma.case.findMany` (not `listCasesForOrg`) — date filters added directly to the route's `andFilters`
- `caseListSelect` needed `offerExpiresAt` and `initialRateEndsAt` added to expose them in list responses
- `vercel.json` had 3 cron entries — 4th added for `lenders-fca`
- Existing cron auth pattern: `CRON_SECRET` header check, 401 if wrong, 503 in production if secret absent, no-op in dev

### Task 7.2 — Radar counts in getDashboardBootstrap ✓
**File:** `apps/web/lib/api/dashboard-data.ts`

Two new `prisma.case.count` calls added in the existing `Promise.all` (6 queries total, one round-trip):
- `offersEnding14d`: `{ offerExpiresAt: { gte: now, lte: now+14d }, stage: { notIn: [COMPLETION, ARCHIVED] }, ...adviserScope }`
- `ratesEnding90d`: `{ initialRateEndsAt: { gte: now, lte: now+90d }, stage: { notIn: [COMPLETION, ARCHIVED] }, ...adviserScope }`

Adviser scope applied via `caseAssignedToAdviserWhere` — same scoping as the case list. Both counts returned at the top level of the bootstrap response alongside `org`, `clients`, `cases`, `advisers`.

Fixed: `as const` on `notIn` array caused TS2322 (`readonly` not assignable to mutable). Cast to `('COMPLETION' | 'ARCHIVED')[]`.

### Task 7.3 — Date filters on GET /api/cases ✓
**File:** `apps/web/app/api/cases/route.ts`

New query params:
- `offerEndingWithinDays` — adds `offerExpiresAt: { gte: now, lte: now + N*days }` to AND filters
- `rateEndingWithinDays` — adds `initialRateEndsAt: { gte: now, lte: now + N*days }` to AND filters

Both are optional, combinable with existing `stage`, `type`, `search`, `adviserId` filters. Invalid/missing values default to `undefined` (filter not applied).

### Task 7.4 — Date fields in caseListSelect ✓
**File:** `apps/web/lib/api/cases-data.ts`

`offerExpiresAt: true` and `initialRateEndsAt: true` added to `caseListSelect`. These fields now appear in every case row returned by `listCasesForOrg` — used by the UI to render the date columns and by the filters to function correctly.

### Task 7.5 — GET/POST /api/cron/lenders-fca ✓
**New file:** `apps/web/app/api/cron/lenders-fca/route.ts`

- Mirrors `intelligence-rates` auth pattern exactly (CRON_SECRET check)
- Returns HTTP 501 `{ ok: false, status: "NOT_IMPLEMENTED", message: "..." }` with a clear message referencing the W0 spike decision document
- The message explains the seed is live and lender search is functional
- Route is production-ready from an auth perspective — only the ingest logic is missing

### Task 7.6 — vercel.json FCA cron entry ✓
**File:** `apps/web/vercel.json`

Added 4th cron:
```json
{ "path": "/api/cron/lenders-fca", "schedule": "0 6 1 * *" }
```

Schedule: 06:00 UTC on the 1st of each month. Once `runFcaIngest()` is implemented, Vercel will automatically start calling this route.

### Task 7.7 — Typecheck + lint ✓
- Fixed TS2322: `['COMPLETION', 'ARCHIVED'] as const` → `as ('COMPLETION' | 'ARCHIVED')[]`
- `tsc --noEmit` → exit 0, zero errors
- `eslint` → exit 0, zero warnings

---

## Files Modified in Phase 7

| File | Change type |
| :---- | :---- |
| `apps/web/lib/api/dashboard-data.ts` | Added `offersEnding14d` + `ratesEnding90d` counts + adviser scoping |
| `apps/web/lib/api/cases-data.ts` | Added `offerExpiresAt` + `initialRateEndsAt` to `caseListSelect` |
| `apps/web/app/api/cases/route.ts` | Added `offerEndingWithinDays` + `rateEndingWithinDays` filter params |
| `apps/web/app/api/cron/lenders-fca/route.ts` | New — FCA cron stub (501 NOT_IMPLEMENTED) |
| `apps/web/vercel.json` | Added 4th cron schedule for lenders-fca |

---

## Remaining Work (FCA cron implementation)

The FCA cron is a stub until the W0 spike decision is recorded in `Doc/PRD-16-Backend-Engineering-Plan.md` Section 7. Once decided:

1. If FCA bulk CSV: implement `lib/api/lenders-fca-ingest.ts` → `runFcaIngest()`
2. Replace the 501 response in `lenders-fca/route.ts` with a call to `runFcaIngest()`
3. Update the `DataFeedStatus` row with `feedId: 'FCA_LENDERS'` on each run
4. Vercel cron schedule is already live — no further config needed

---

## Test Guide

See `Doc/PRD-16-Phase7-Test-Guide.md`.

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
