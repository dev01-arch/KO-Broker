# PRD-16 Backend Engineering Plan

## Case Journey, Book of Business & Lender Directory

| Field | Detail |
| :---- | :---- |
| **Document type** | Backend Engineering Plan (cross-reference of PRD-16 against current codebase) |
| **Author** | Backend Engineer |
| **PRD** | PRD-16 v1.0 — 15 September 2026 |
| **Status** | AWAITING REVIEW — do not build |
| **Codebase snapshot** | September 2026 |

---

## 1. Current State — What Already Exists

Before listing what needs to change, this section documents what the codebase already has so we do not rebuild it.

### Schema (packages/db/prisma/schema.prisma)

| Model | Key fields | Gap vs PRD-16 |
| :---- | :---- | :---- |
| `Case` | `propertyValue`, `loanAmount`, `ltv`, `termYears`, `selectedLender` (string), `selectedProduct`, `selectedRate`, `selectedFee`, `adviserNotes` (single string), `assignedAdviserId`, `stage`, `type` | Missing: date spine (7 date fields), account strip (rateType, monthlyPayment, initialRateEndsAt, chargeType, isOffset), `lenderId FK`, `propertyId FK`, `recommendationStaleAt`, `recommendationStaleReason` |
| `FactFind` | 7 untyped `Json` sections: `personalDetails`, `employmentDetails`, `incomeDetails`, `expenditureDetails`, `propertyDetails`, `existingMortgages`, `clientPreferences`. `completedAt` flag | `propertyDetails` is a JSON blob, not a first-class `Property` row. No `isAmended` flag |
| `ProductConsidered` | `lenderName` (free text string), `productName`, `rate`, `fee`, `isSelected`, `reasonNotSelected` | Missing: `lenderId FK`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary`. `lenderName` is not referential |
| `LenderCriteria` | Global. `lenderName @unique`, `maxLtv`, `minIncome`, `maxLoanAmount`, `acceptedEmploymentTypes[]`, `minCreditScore`, `specialConditions` | This is NOT a `Lender` directory — it is a criteria table. The `Lender` model does not exist at all |
| `AuditLog` | INSERT-ONLY. `entityType`, `entityId`, `action`, `diff Json`. `logAuditEvent()` is centralised | Fully functional. No changes needed to the model itself |
| `Message` | Multi-channel, direction, threadId, `broadcastMessageForOrg()` | Fully functional. The `info-requests` system will reuse this path |
| `SuitabilityReport` | `status` enum: DRAFT → ADVISER_REVIEW → APPROVED → FINALISED | Needs: stale-aware logic in generate/advance. FINALISED reports must be protected from mutation |
| `Client` | `portalEnabled`, `portalAccessToken`, `annualIncome`, `isVulnerable` | Missing `Property` relation |
| `CaseIntelligenceSnapshot` | Has `postcode`, reads from `propertyValue` passed in | Preview fill currently re-asks for postcode if not on case |

### API Routes (apps/web/app/api/)

| Existing route | Handles |
| :---- | :---- |
| `GET/POST /api/cases` | List + create |
| `GET/PATCH /api/cases/[id]` | Detail + update |
| `PUT /api/cases/[id]/fact-find` | Upsert fact-find |
| `GET/POST /api/cases/[id]/products` | List + create products |
| `PATCH/DELETE /api/cases/[id]/products/[productId]` | Update + remove product |
| `GET /api/cases/[id]/timeline` | AuditLog timeline |
| `GET/POST /api/clients` | List + create |
| `GET/PATCH/DELETE /api/clients/[id]` | Client CRUD |
| `GET /api/dashboard/bootstrap` | Bootstrap payload |
| `GET /api/intelligence/cases/[caseId]/preview` | Intel pre-fill from case |
| `GET/POST /api/cron/intelligence-rates` | BoE rate ingest |
| `GET/POST /api/cron/intelligence-prices` | HMLR price ingest |
| `GET/POST /api/cron/message-email-digests` | Digest processor |
| `POST /api/messages` | Send message |
| `POST /api/compliance/advance` | Advance compliance stage |
| `POST /api/compliance/items` | Complete checklist item |
| `POST /api/ai/generate-report` | Generate suitability report |
| `POST /api/ai/regenerate-section` | Regenerate report section |

### Lib / data layer

| File | Status |
| :---- | :---- |
| `lib/api/cases-data.ts` | Handles CRUD, LTV calc, reference generation, stage validation |
| `lib/api/fact-find-data.ts` | Upsert with vulnerability scoring, auto stage advance, portal completion |
| `lib/api/products-data.ts` | Full product CRUD with transactional selection/deselection sync to Case fields |
| `lib/api/messages-data.ts` | `broadcastMessageForOrg`, multi-channel, digest, portal-invite integration |
| `lib/compliance/audit.ts` | `logAuditEvent`, `computeDiff` — INSERT-ONLY, centralised |
| `lib/compliance/workflow.ts` | Stage sequence, `verifyStageChecklist`, compliance→case stage mapping |
| `lib/api/dashboard-data.ts` | Bootstrap: org + clients + cases + advisers |

---

## 2. What PRD-16 Requires from Backend — Complete List

Each item is mapped to a workstream and tagged NEW / MODIFY / EXTEND.

---

## W0 — Schema and Seed

### W0.1 — New `Lender` model (NEW)

The platform's central lender directory. Global reference data (no `orgId`). Every place a lender is currently typed as a free-text string will instead reference this table.

**Schema to add:**

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

**Rules:**
- `normalizedName`: lowercase + stripped punctuation for deduplication. Compute at write time: `name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()`
- The `Other` row is a reserved seed row with `source = OTHER`. It is never deactivated.
- LEGACY rows (Bradford & Bingley, NRAM, Mortgage Express, Intelligent Finance — and any others KO advisers confirm) are kept active for remortgage lookup; they just cannot be used on a new product without consent.
- Rows referenced by any `ProductConsidered` or `Case` must never be renamed or deleted.

**Dependencies:** This model must be seeded before W1 can run.

---

### W0.2 — New `Property` model (NEW)

Promotes property off the `FactFind.propertyDetails` JSON blob onto a first-class client-owned record.

```prisma
enum PropertyType {
  RESIDENTIAL
  BTL
  OTHER
}

model Property {
  id            String       @id @default(cuid())
  orgId         String
  clientId      String
  address       Json?
  postcode      String
  tenure        String?
  type          PropertyType @default(RESIDENTIAL)
  currentValue  Float?
  monthlyRent   Float?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  organisation Organisation @relation(fields: [orgId], references: [id])
  client       Client       @relation(fields: [clientId], references: [id])
  cases        Case[]

  @@map("properties")
}
```

**Relations to add:**
- `Client` gets `properties Property[]`
- `Case` gets `propertyId String?` FK → `Property.id` + `property Property? @relation(...)` 

**Migration note:** Best-effort backfill: for each case that has a `FactFind.propertyDetails` blob with an address or postcode, create one `Property` row for that client and point `Case.propertyId` at it. Write the migration script to be non-failing on malformed JSON — log and skip, do not crash.

---

### W0.3 — New `CaseNote` model (NEW)

Replaces `Case.adviserNotes` (a single overwriting string) with an append-only thread.

```prisma
enum CaseNoteSource {
  ADVISER
  INTEL
  SYSTEM
}

model CaseNote {
  id           String        @id @default(cuid())
  orgId        String
  caseId       String
  body         String
  tag          String?
  authorUserId String?
  source       CaseNoteSource @default(ADVISER)
  createdAt    DateTime      @default(now())

  case         Case          @relation(fields: [caseId], references: [id])
  author       User?         @relation(fields: [authorUserId], references: [id])

  @@map("case_notes")
}
```

**Rules:**
- INSERT-ONLY (same discipline as `AuditLog`). No `UPDATE` or `DELETE` in the API.
- `tag` values in use: `intel` (Intel copy-to-notes), `disclosure`, `amend` (stale-clear event), `system`.
- `Case` gets `notes CaseNote[]` relation.
- Migration: if `Case.adviserNotes` is non-empty, create one `CaseNote { source: ADVISER, tag: null, body: existingNotes }` per case. Keep the `adviserNotes` column readable for one release; stop writing it in new code from W2 onwards.

---

### W0.4 — New `ClientInfoRequest` model (NEW)

Lightweight record that ties a "request from client" action to a message and tracks outstanding status until fulfilled.

```prisma
enum InfoRequestStatus {
  OUTSTANDING
  FULFILLED
  CANCELLED
}

model ClientInfoRequest {
  id                 String            @id @default(cuid())
  orgId              String
  caseId             String
  clientId           String
  checklistItemId    String?
  documentType       String?
  messageId          String?
  status             InfoRequestStatus @default(OUTSTANDING)
  fulfilledDocumentId String?
  createdAt          DateTime         @default(now())
  fulfilledAt        DateTime?

  case               Case             @relation(fields: [caseId], references: [id])
  client             Client           @relation(fields: [clientId], references: [id])

  @@map("client_info_requests")
}
```

**Fulfilment trigger:** When a `Document` is uploaded for a case and its `documentType` matches an `OUTSTANDING` `ClientInfoRequest.documentType` on the same case, auto-set `status = FULFILLED`, `fulfilledAt = now()`, `fulfilledDocumentId = document.id`. Alternatively, when the adviser manually marks the compliance checklist item complete, also fulfil any matching outstanding request.

---

### W0.5 — Case model additions (MODIFY)

Add to the existing `Case` model:

```prisma
// Date spine
aipAt            DateTime?
submittedAt      DateTime?
offerIssuedAt    DateTime?
offerExpiresAt   DateTime?
exchangeAt       DateTime?
completionAt     DateTime?

// Account strip
rateType         String?
monthlyPayment   Float?
initialRateEndsAt DateTime?
chargeType       String?
isOffset         Boolean?

// Lender FK (replaces free-text selectedLender eventually)
lenderId         String?
lenderOtherName  String?

// Property FK
propertyId       String?

// Stale recommendation
recommendationStaleAt     DateTime?
recommendationStaleReason String?
```

**Migration strategy:**
- `selectedLender` (the existing string) stays readable for one release.
- `lenderId` is backfilled by matching `selectedLender` against `Lender.name` after the lender seed runs.
- After backfill, new code writes `lenderId`, not `selectedLender`.
- `propertyId` starts null; W3 creates Property rows and backfills this.

---

### W0.6 — ProductConsidered model additions (MODIFY)

Add to existing `ProductConsidered`:

```prisma
lenderId           String?
lenderOtherName    String?
productType        String?
initialTermMonths  Int?
ercSummary         String?
```

Add the relation: `lender Lender? @relation(fields: [lenderId], references: [id])`

**Migration:** The existing `lenderName` column stays and is populated from backfill. New code writes `lenderId`. When `lenderId` is set, `lenderName` should still be written (derived from `lender.name`) so reporting code does not break during the transition.

---

### W0.7 — Lender seed script (NEW)

A one-time script (`packages/db/prisma/seed-lenders.ts` or similar, runnable via `pnpm db:seed-lenders`) that:

1. Reads the 190 names from Appendix A of PRD-16.
2. Computes `normalizedName` for each.
3. Upserts on `normalizedName` (in case the script is re-run).
4. Sets `status = LEGACY` for: Bradford & Bingley, Intelligent Finance, Mortgage Express, NRAM.
5. Ensures the `Other` row exists with `source = OTHER, status = ACTIVE`.
6. Does NOT fail if any row already exists (idempotent).

**Rider task:** Proofread the 190 names against Appendix A before running. Watch for: "Coutts" not "Couts", "Atom bank" vs "Digital Mortgages / Atom bank", any hidden duplicates after normalization.

---

### W0.8 — FCA spike decision (RESEARCH)

**Not a build item yet.** Backend engineer (with Head of D&E, 2 hours) must:
- Locate the FCA FS Register bulk data file (firms with permission to enter into a regulated mortgage contract).
- Confirm whether a bulk CSV/JSON download is practical or requires hitting individual API endpoints.
- Write a 1-page decision note (update this document under Section 5 — Decisions) before W6 starts.
- If the bulk file is impractical, document the Settings CSV upload fallback for v1 and still ship the seed.

---

### W0.9 — Zod types in @ko/types (EXTEND)

New schemas to add to `packages/types/src/index.ts`:

```typescript
// W0 enums
export const LenderStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'LEGACY'])
export const LenderSourceSchema = z.enum(['SEED', 'FCA', 'OTHER'])
export const PropertyTypeSchema = z.enum(['RESIDENTIAL', 'BTL', 'OTHER'])
export const CaseNoteSourceSchema = z.enum(['ADVISER', 'INTEL', 'SYSTEM'])
export const InfoRequestStatusSchema = z.enum(['OUTSTANDING', 'FULFILLED', 'CANCELLED'])

// W0 API schemas
export const LenderSchema = z.object({ id, name, normalizedName, fcaFrn, status, source, lastSeenAt, createdAt, updatedAt })
export const LenderQuerySchema = z.object({ q: z.string().optional() })

// W1 schemas
export const CreateProductConsideredSchema  // extend with lenderId, lenderOtherName, productType, initialTermMonths, ercSummary
export const UpdateProductConsideredSchema  // extend same

// W2 schemas
export const CreateCaseNoteSchema = z.object({ body, tag })
export const UpdateCaseDateSpineSchema = z.object({ aipAt, submittedAt, offerIssuedAt, offerExpiresAt, exchangeAt, completionAt, rateType, monthlyPayment, initialRateEndsAt, chargeType, isOffset })

// W3 schemas
export const CreatePropertySchema = z.object({ address, postcode (required), tenure, type, currentValue, monthlyRent })
export const UpdateCasePropertySchema = z.object({ propertyId })

// W5 schemas
export const CreateInfoRequestSchema = z.object({ checklistItemId?, documentType?, body?, channel? })
```

---

## W1 — Lender Select

### W1.1 — GET /api/lenders (NEW route)

```
GET /api/lenders?q=clydes    → [{ id, name, normalizedName, status, source }]
```

**Implementation:**
- New file: `apps/web/app/api/lenders/route.ts`
- New data function: `apps/web/lib/api/lenders-data.ts` → `searchLenders(q: string)`
- Prisma query: `prisma.lender.findMany({ where: { name: { contains: q, mode: 'insensitive' }, status: { not: 'INACTIVE' } }, orderBy: { name: 'asc' }, take: 20 })`
- Returns ACTIVE + LEGACY rows. INACTIVE is hidden from search.
- `Other` row is always included (appended last in results, or returned as a special sentinel).
- No auth gating beyond the standard Clerk session — this is org-scoped at the session level, but the lender data itself is global.
- Acceptance test: `GET /api/lenders?q=clydes` returns exactly one row with `name = "Clydesdale Bank PLC"`.

### W1.2 — POST /api/cases/[id]/products — extend to accept lenderId (MODIFY)

The existing `CreateProductConsideredSchema` uses `lenderName: z.string()`. Change to:
- `lenderId: z.string().optional()` — FK to Lender
- `lenderOtherName: z.string().optional()` — required when `lenderId` is the `Other` sentinel row
- `productType: z.string().optional()`
- `initialTermMonths: z.number().int().optional()`
- `ercSummary: z.string().optional()`

**Validation rule:** if `lenderId` is provided and is not the `Other` row, `lenderOtherName` must be absent. If `lenderId` is the `Other` row, `lenderOtherName` is required. If neither `lenderId` nor `lenderName` is provided, reject.

**Backward compatibility:** Accept `lenderName` as a fallback for existing callers during the transition. When `lenderId` is provided, derive `lenderName` from `lender.name` and write both.

**In `createProductForCase` / `updateProductForCase` (`lib/api/products-data.ts`):** after the transaction, when a product is selected, also write `Case.lenderId = product.lenderId` (alongside the existing `selectedLender` string sync).

### W1.3 — PATCH /api/cases/[id]/products/[productId] — extend (MODIFY)

Same field additions as W1.2 for the update path.

### W1.4 — Unit tests (NEW)

- `lender-search.test.ts`: search by partial name, case-insensitive, INACTIVE is excluded, LEGACY is included, `Other` always appears.
- `lender-other-override.test.ts`: `lenderId = Other + lenderOtherName` creates product; `lenderId = Other` without name rejects.
- `lender-normalized-unique.test.ts`: seeding "NatWest" and "natwest" normalizes to same key and upserts rather than duplicating.

---

## W2 — Case Overview Accordions

### W2.1 — GET/POST /api/cases/[id]/notes (NEW routes)

**GET:** `apps/web/app/api/cases/[id]/notes/route.ts`
- Returns all `CaseNote` rows for the case, ordered by `createdAt asc`, with `author { firstName, lastName }`.
- Standard org-scope guard.

**POST:** Same file.
- Body: `{ body: string, tag?: string }`
- Writes `CaseNote { orgId, caseId, body, tag, authorUserId: currentUser.id, source: 'ADVISER' }`.
- INSERT-ONLY — no update/delete endpoints.
- Also fires `logAuditEvent { action: 'CASE_NOTE_ADDED', diff: { body, tag } }`.

**Intel copy-to-notes:** The existing intelligence flow (`POST /api/intelligence/snapshots` or the confirm-from-case path) currently writes to `Case.adviserNotes` (a string). Modify `lib/intelligence/intel-data.ts` (or wherever the copy-to-notes write happens) to instead call the `CaseNote` insert with `source: 'INTEL', tag: 'intel'`. Stop writing `Case.adviserNotes` after this migration.

### W2.2 — PATCH /api/cases/[id] — extend to accept date spine and account strip (MODIFY)

Extend `UpdateCaseSchema` in `@ko/types` to include all date spine and account strip fields:
```
aipAt, submittedAt, offerIssuedAt, offerExpiresAt, exchangeAt, completionAt,
rateType, monthlyPayment, initialRateEndsAt, chargeType, isOffset
```

In `updateCaseForOrg` (`lib/api/cases-data.ts`): pass these through to the Prisma update. No business logic beyond null-coalescing — these are informational fields.

Audit: `logAuditEvent { action: 'CASE_UPDATED', diff: computeDiff(existing, updated) }` — already fires on every PATCH; the new fields will appear in the diff automatically.

### W2.3 — Migrate adviserNotes (MIGRATION)

Write a Prisma migration script that:
1. Queries all `Case` rows where `adviserNotes IS NOT NULL AND adviserNotes != ''`
2. For each, inserts one `CaseNote { source: 'ADVISER', tag: null, body: adviserNotes, authorUserId: null }`
3. Does NOT clear `adviserNotes` (kept readable for one release)
4. Is idempotent (check if a note already exists for that case before inserting)

### W2.4 — GET /api/cases/[id] — include notes in response (MODIFY)

Add `notes` to the case detail query in `getCaseForOrg`:
```typescript
notes: { 
  orderBy: { createdAt: 'asc' }, 
  include: { author: { select: { id, firstName, lastName } } } 
}
```

---

## W3 — Property on Client + Postcode at Case Create

### W3.1 — POST /api/clients/[id]/properties (NEW route)

New file: `apps/web/app/api/clients/[id]/properties/route.ts`

**POST:**
- Body: `CreatePropertySchema { address?, postcode (required), tenure?, type?, currentValue?, monthlyRent? }`
- Creates `Property { orgId, clientId, ...input }`
- Returns the created property.
- `logAuditEvent { action: 'PROPERTY_CREATED', entityType: 'Client', entityId: clientId }`

**GET:**
- Returns all properties for the client: `prisma.property.findMany({ where: { clientId, orgId } })`

### W3.2 — POST /api/cases — extend to accept postcode and optional property (MODIFY)

Extend `CreateCaseSchema` in `@ko/types`:
```typescript
postcode: z.string().optional(),
propertyId: z.string().optional(),    // link existing property
propertyValue: ...,                    // already exists
loanAmount: ...,                       // already exists
termYears: ...,                        // already exists
```

In `createCaseForOrg`:
- If `postcode` is provided and `propertyId` is not, create a new `Property { orgId, clientId, postcode, currentValue: propertyValue }` and set `Case.propertyId` to it.
- If `propertyId` is provided, validate it belongs to the same client + org, then set `Case.propertyId`.
- If neither, `propertyId` stays null.

### W3.3 — GET /api/clients/[id] — include properties in response (MODIFY)

Add `properties: { orderBy: { createdAt: 'desc' } }` to the client detail query in `getClientForOrg`.

### W3.4 — Intelligence preview reads Property.postcode (MODIFY)

In `GET /api/intelligence/cases/[caseId]/preview` — the handler currently reads `case.propertyValue` and other fields. Extend it to:
1. Include `case.property { select: { postcode: true } }` in the Prisma query.
2. If `property.postcode` exists, include it in the preview response so the Intel confirm-from-case form does not re-ask.
3. If `Case.propertyId` is null (old cases without property), fall back to the existing behaviour (ask for postcode in the UI — handled by frontend).

The `CasePreviewResponse` type in `@ko/types` needs a `postcode?: string` field added.

---

## W4 — Amend and Stale Recommendation

This is the most complex wave from a business-logic perspective. Every mutation path that can change the recommendation's validity must be covered.

### W4.1 — Stale detection function (NEW)

New function in `lib/api/cases-data.ts` (or a dedicated `lib/compliance/stale.ts`):

```typescript
async function checkAndSetRecommendationStale(
  tx: PrismaTransactionClient,
  caseId: string,
  changedFields: string[],
  reason: string,
): Promise<boolean>
```

**Logic:**
1. Check if the case has at least one `ProductConsidered` with `isSelected = true`. If not, skip entirely (no recommendation to mark stale).
2. Check if `recommendationStaleAt` is already set. If already stale, still update the reason but do not double-fire the cascade.
3. Set `Case.recommendationStaleAt = now()`, `Case.recommendationStaleReason = reason`.
4. Find all `SuitabilityReport` rows for the case with `status IN ('DRAFT', 'ADVISER_REVIEW')`. Set their status back to `'DRAFT'`.
5. `APPROVED` and `FINALISED` reports are NOT touched.
6. Write `CaseNote { source: 'SYSTEM', tag: 'amend', body: 'Recommendation marked stale: {reason}' }`.
7. `logAuditEvent { action: 'RECOMMENDATION_STALE', diff: { reason, changedFields } }`.
8. Returns `true` if stale was set, `false` if skipped.

**Qualifying stale triggers (all must pass through this function):**
- `Case.loanAmount` changes in `updateCaseForOrg`
- `Case.propertyValue` changes in `updateCaseForOrg`
- `Case.termYears` changes in `updateCaseForOrg`
- `Case.ltv` changes as a consequence of the above
- `Case.propertyId` changes (different property linked)
- `FactFind.incomeDetails` changes on amend
- `FactFind.expenditureDetails` changes on amend
- `FactFind.propertyDetails` changes on amend
- `FactFind.existingMortgages` changes on amend
- `Client.annualIncome` update (if used in the Intel/affordability calculation)

### W4.2 — Hook stale check into PATCH /api/cases/[id] (MODIFY)

In `updateCaseForOrg`, after the Prisma update:
- Compare `input.loanAmount`, `input.propertyValue`, `input.termYears`, `input.propertyId` against the `existing` record snapshot taken before the update.
- If any qualifying field changed, call `checkAndSetRecommendationStale(tx, caseId, changedFields, 'Case financial details updated')`.
- Run the case update and stale check inside a single Prisma `$transaction`.

### W4.3 — Fact-find Amend path (MODIFY)

The existing `upsertFactFindWithCompliance` has a guard: if `factFind.completedAt` is set and `!options?.allowWhenComplete` and `!input.markComplete`, it returns `{ error: 'FORBIDDEN' }`. This is the current "can't edit a completed fact-find" gate.

The `Amend` path must:
1. Accept a new input flag `isAmend: boolean` on `UpsertFactFindInput`.
2. When `isAmend: true` and `factFind.completedAt` is set, bypass the FORBIDDEN guard (allow the edit).
3. After the upsert, `logAuditEvent { action: 'FACT_FIND_AMENDED', diff: computeDiff(before, after) }`. This is distinct from the existing `FACT_FIND_UPDATED` action.
4. If any qualifying sections changed (incomeDetails, expenditureDetails, propertyDetails, existingMortgages), call `checkAndSetRecommendationStale`.
5. The `FACT_FIND_AMENDED` action must fire even if the fact-find was previously completed — it is the audit trail evidence.

**Note:** `allowWhenComplete` is already used by the case-side route (`lib/api/cases-data.ts: upsertFactFindForCase`) which passes `{ allowWhenComplete: true }`. The amend path is a *separate explicit* mode that writes the audit event with the amend action. Do not conflate the two.

### W4.4 — Stale clear path (NEW)

When an adviser re-selects a product (sets `isSelected: true` on any `ProductConsidered`), the stale flag must be cleared:
1. In `createProductForCase` / `updateProductForCase`, after a product is selected, check if `recommendationStaleAt` is set.
2. If stale, clear it: `Case.recommendationStaleAt = null`, `Case.recommendationStaleReason = null`.
3. Write `CaseNote { source: 'SYSTEM', tag: 'amend', body: 'Recommendation updated: product re-selected' }`.
4. `logAuditEvent { action: 'RECOMMENDATION_STALE_CLEARED', diff: { productId, lenderName } }`.
5. Run within the existing product selection transaction.

### W4.5 — FINALISED report protection (VERIFY)

In `POST /api/ai/generate-report`: the stale flag does NOT block generation. A stale recommendation just means the report starts DRAFT. No change needed to the generation logic itself.

In the report status advance route (wherever PATCH on a report status happens): add a guard that `FINALISED` reports cannot be moved backward. This constraint likely already exists but must be confirmed.

### W4.6 — Tests (NEW)

- `stale-on-loan-change.test.ts`: change `loanAmount` after a product is selected → `recommendationStaleAt` is set, non-FINALISED report returns to DRAFT, FINALISED report is untouched.
- `stale-on-amend.test.ts`: amend incomeDetails on a completed fact-find with a selected product → stale is set, audit log has `FACT_FIND_AMENDED`.
- `stale-clear-on-reselect.test.ts`: re-select a product → `recommendationStaleAt` is null, CaseNote with tag `amend` exists.
- `finalised-report-protected.test.ts`: FINALISED report stays FINALISED after loan change.

---

## W5 — Request from Client

### W5.1 — POST /api/cases/[id]/info-requests (NEW route)

New file: `apps/web/app/api/cases/[id]/info-requests/route.ts`

**POST body:**
```typescript
{
  checklistItemId?: string,   // ties to compliance checklist item
  documentType?: string,      // ties to DocumentType enum
  body?: string,              // custom body override; default is pre-filled template
  channel?: MessageChannel,   // default: use org settings (same as broadcastMessageForOrg)
}
```

**Implementation in `lib/api/info-requests-data.ts`:**

1. Validate case exists in org.
2. Construct message body: `body ?? "Please upload [documentType / checklistItem label] for case {referenceNumber}. [portal link if client has portal access]"`.
3. Call `broadcastMessageForOrg(orgId, { body, caseId, clientId, sourceType: 'COMPLIANCE', subject: 'Document Request — {referenceNumber}' })`. This reuses the full PRD-10 send path including SMS, email, portal link.
4. Create `ClientInfoRequest { orgId, caseId, clientId, checklistItemId, documentType, messageId: message.id, status: 'OUTSTANDING' }`.
5. `logAuditEvent { action: 'INFO_REQUEST_CREATED', entityType: 'Case', entityId: caseId, diff: { checklistItemId, documentType } }`.
6. Return `{ infoRequest, message }`.

**Portal vs no-portal path:**
- `broadcastMessageForOrg` already handles this: if the client has `portalPasswordHash` (portal set up), the message includes a portal deep link. If not, the client gets an email with the message body and a portal invite. No new logic needed here — the existing message system covers it.

### W5.2 — GET /api/cases/[id]/info-requests (NEW)

Returns all `ClientInfoRequest` rows for the case, joined with `message { id, createdAt }`.

### W5.3 — Auto-fulfil on document upload (MODIFY)

In the document upload handler (`POST /api/documents`):
- After creating the `Document` row, query: `prisma.clientInfoRequest.findMany({ where: { caseId: document.caseId, documentType: document.documentType, status: 'OUTSTANDING' } })`
- For each matching request: `prisma.clientInfoRequest.update({ data: { status: 'FULFILLED', fulfilledAt: new Date(), fulfilledDocumentId: document.id } })`
- `logAuditEvent { action: 'INFO_REQUEST_FULFILLED', entityType: 'Case', entityId: caseId }`.

### W5.4 — Fulfil via compliance item complete (MODIFY)

In `POST /api/compliance/items` (when an adviser marks a checklist item complete):
- After recording the `ComplianceRecord`, query for `OUTSTANDING` `ClientInfoRequest` rows where `checklistItemId = completedItemId`.
- Fulfil them: `status = 'FULFILLED', fulfilledAt = now()`.

### W5.5 — GET /api/cases/[id] — include info-requests in response (MODIFY)

Add `infoRequests: { where: { status: 'OUTSTANDING' }, orderBy: { createdAt: 'desc' } }` to the case detail query so the frontend can show the outstanding badge count without a separate call.

---

## W6 — Radar and FCA Sync

### W6.1 — Dashboard bootstrap — add radar counts (MODIFY)

In `getDashboardBootstrap` (`lib/api/dashboard-data.ts`), add two Prisma count queries:

```typescript
const [offersEnding14d, ratesEnding90d] = await Promise.all([
  prisma.case.count({
    where: {
      orgId,
      stage: { notIn: ['COMPLETION', 'ARCHIVED'] },
      offerExpiresAt: { gte: now, lte: addDays(now, 14) },
    },
  }),
  prisma.case.count({
    where: {
      orgId,
      stage: { notIn: ['COMPLETION', 'ARCHIVED'] },
      initialRateEndsAt: { gte: now, lte: addDays(now, 90) },
    },
  }),
])
```

Add `offersEnding14d: number` and `ratesEnding90d: number` to the bootstrap response object. Update `ApiSuccessResponse` meta or the bootstrap response type in `@ko/types`.

**Note:** Apply adviser scoping the same way as clients/cases — if `restrictToAdviserUserId` is set, add a `CaseAdviser` or `caseAssignedToAdviserWhere` filter to the count queries.

### W6.2 — Cases list — date column filtering (MODIFY)

Extend `listCasesForOrg` params to accept:
```typescript
offerEndingWithinDays?: number,
rateEndingWithinDays?: number,
```

When `offerEndingWithinDays = 14`, add `offerExpiresAt: { gte: now, lte: addDays(now, 14) }` to the `where` clause.

Extend `caseListSelect` to include `offerExpiresAt` and `initialRateEndsAt` so the Cases list can render the date columns.

### W6.3 — FCA cron route (NEW)

New file: `apps/web/app/api/cron/lenders-fca/route.ts`

**Pattern:** Mirrors the existing `intelligence-rates` / `intelligence-prices` cron pattern exactly:
- Accepts both GET and POST.
- Requires `Authorization: Bearer CRON_SECRET` in production.
- Returns `{ success, inserted, deactivated, feedStatus }`.
- Updates a new `DataFeedStatus` row with `feedId = 'FCA_LENDERS'` on every run.

**Implementation in `lib/api/lenders-fca-ingest.ts`:**

1. Fetch the FCA bulk data source (endpoint TBD from W0 spike decision).
2. For each firm in the source, compute `normalizedName`.
3. Upsert: `prisma.lender.upsert({ where: { normalizedName }, create: { name, normalizedName, fcaFrn, source: 'FCA', status: 'ACTIVE', lastSeenAt: now }, update: { lastSeenAt: now, fcaFrn: (if new) } })`.
4. Append-only: never rename or delete any row that has `ProductConsidered` references. Skip rename even if the FCA name differs.
5. After processing, find all `Lender` rows with `source = 'FCA', status = 'ACTIVE', lastSeenAt < (2 runs ago)`. Mark them `INACTIVE`. (Two-run grace period prevents flash deactivation.)
6. Never touch rows with `source = SEED` or `source = OTHER`.

**Fallback:** If the FCA bulk file is impractical (per W0 decision), implement a `POST /api/settings/lenders/import` endpoint instead that accepts a CSV upload. Same upsert logic, manual trigger, no cron. This is the v1 fallback; the cron route ships empty (returns 501) until the FCA source is confirmed.

### W6.4 — vercel.json — add FCA cron schedule

When the FCA cron implementation is confirmed, add a schedule entry to `vercel.json`. The PRD suggests monthly. A reasonable schedule: `"0 6 1 * *"` (06:00 UTC on the 1st of each month). This is a config change, not a code change, but it needs a PR.

---

## 3. Full API Contract Summary

All new and modified routes in one place for reference.

### New routes

| Method | Path | Body / Params | Returns | Wave |
| :---- | :---- | :---- | :---- | :---- |
| GET | `/api/lenders` | `?q=string` | `Lender[]` (max 20, ACTIVE+LEGACY) | W0 |
| GET | `/api/cases/:id/notes` | — | `CaseNote[]` with author | W2 |
| POST | `/api/cases/:id/notes` | `{ body, tag? }` | `CaseNote` | W2 |
| GET | `/api/clients/:id/properties` | — | `Property[]` | W3 |
| POST | `/api/clients/:id/properties` | `CreatePropertySchema` | `Property` | W3 |
| GET | `/api/cases/:id/info-requests` | — | `ClientInfoRequest[]` | W5 |
| POST | `/api/cases/:id/info-requests` | `CreateInfoRequestSchema` | `{ infoRequest, message }` | W5 |
| GET/POST | `/api/cron/lenders-fca` | CRON\_SECRET | `{ success, inserted, deactivated }` | W6 |

### Modified routes

| Method | Path | What changes | Wave |
| :---- | :---- | :---- | :---- |
| POST | `/api/cases` | Accept `postcode`, `propertyId`; auto-create Property | W3 |
| PATCH | `/api/cases/:id` | Accept date spine + account strip fields; trigger stale check | W2/W4 |
| GET | `/api/cases/:id` | Include `notes[]`, `infoRequests[]` in response | W2/W5 |
| GET | `/api/cases` (list) | Accept `offerEndingWithinDays`, `rateEndingWithinDays` filters | W6 |
| POST | `/api/cases/:id/products` | Accept `lenderId`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary` | W1 |
| PATCH | `/api/cases/:id/products/:id` | Same new fields | W1 |
| PUT | `/api/cases/:id/fact-find` | Accept `isAmend: boolean`; trigger stale check on qualifying sections | W4 |
| GET | `/api/dashboard/bootstrap` | Add `offersEnding14d`, `ratesEnding90d` counts | W6 |
| GET | `/api/intelligence/cases/:id/preview` | Read `property.postcode` first; add `postcode` to response | W3 |
| POST | `/api/documents` | Auto-fulfil matching OUTSTANDING info requests | W5 |
| POST | `/api/compliance/items` | Fulfil matching OUTSTANDING info requests | W5 |
| GET | `/api/clients/:id` | Include `properties[]` in response | W3 |

---

## 4. Migration Plan

Migrations should be additive and non-destructive. Run in this order:

### Migration 1 (W0) — New models

Add:
- `LenderStatus` enum
- `LenderSource` enum
- `PropertyType` enum
- `CaseNoteSource` enum
- `InfoRequestStatus` enum
- `Lender` table
- `Property` table
- `CaseNote` table
- `ClientInfoRequest` table

Add nullable columns to `Case`:
- `propertyId`, `lenderId`, `lenderOtherName`
- Date spine: `aipAt`, `submittedAt`, `offerIssuedAt`, `offerExpiresAt`, `exchangeAt`, `completionAt`
- Account: `rateType`, `monthlyPayment`, `initialRateEndsAt`, `chargeType`, `isOffset`
- Stale: `recommendationStaleAt`, `recommendationStaleReason`

Add nullable columns to `ProductConsidered`:
- `lenderId`, `lenderOtherName`, `productType`, `initialTermMonths`, `ercSummary`

**All new columns are nullable. Zero existing rows are affected. Migration is safe to run on live data.**

### Migration 2 (W0, after seed) — Lender backfill

Run after the seed script populates `Lender`:
1. For each `ProductConsidered` row where `lenderName` matches a `Lender.name` (case-insensitive), update `lenderId`.
2. For each `Case` row where `selectedLender` matches a `Lender.name`, update `lenderId`.
3. Log unmatched `lenderName` values so they can be added to the seed or flagged for `Other`.

### Migration 3 (W0/W2) — adviserNotes backfill

For each `Case` row with non-empty `adviserNotes`:
- Insert one `CaseNote { caseId, orgId, body: adviserNotes, source: 'ADVISER', tag: null, authorUserId: null, createdAt: case.updatedAt }`.
- Do not clear `adviserNotes` yet.

### Migration 4 (W3) — Property backfill

For each `FactFind` where `propertyDetails` has a parseable `postcode` or `address`:
- Extract the postcode (best-effort JSON parse).
- Create `Property { orgId: case.orgId, clientId: case.clientId, postcode: extracted, address: extracted, type: RESIDENTIAL (default) }`.
- Set `Case.propertyId` to the new property.
- Skip on JSON parse error — log the caseId for manual review.

**This migration is non-failing by design. Bad JSON = skip and log.**

---

## 5. Approach Notes and Patterns to Follow

These are constraints from the existing codebase that every new piece of code must respect.

### Pattern: org-scoped auth

Every non-cron route handler starts with:
```typescript
const { userId, orgId } = await requireAuth()
```
New routes follow the same pattern. The `lenders` route returns global data but must still require a valid session.

### Pattern: devStore fallback

Every data function catches Prisma connection errors in development and falls back to an in-memory `devStore`. New data functions should follow this pattern for the same reason — consistent local dev experience without a live DB.

### Pattern: audit on every mutation

Every `POST`, `PATCH`, `DELETE` that changes meaningful state calls `logAuditEvent`. New routes must do the same. Use the existing action string conventions:
- `CASE_NOTE_ADDED`
- `PROPERTY_CREATED`
- `INFO_REQUEST_CREATED`
- `INFO_REQUEST_FULFILLED`
- `RECOMMENDATION_STALE`
- `RECOMMENDATION_STALE_CLEARED`
- `FACT_FIND_AMENDED`
- `LENDER_FCA_SYNC` (from cron)

### Pattern: INSERT-ONLY tables

`CaseNote` and `AuditLog` are INSERT-ONLY. There must be no `UPDATE` or `DELETE` API endpoints for either. Treat this as a hard constraint, not a suggestion.

### Pattern: transaction wrapping

Multi-table mutations that must be atomic (product selection → case sync → stale check) run inside `prisma.$transaction`. The existing `createProductForCase` and `updateProductForCase` already do this. The stale detection function must accept a `tx` parameter to participate in the caller's transaction.

### Pattern: CRON_SECRET auth

All cron routes use the same auth check already present in `intelligence-rates` and `intelligence-prices`. Copy the same check into `lenders-fca/route.ts`:
```typescript
const secret = req.headers.get('authorization')?.replace('Bearer ', '')
if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Pattern: @ko/types schemas first

All new request bodies must have a Zod schema in `packages/types/src/index.ts` before the route handler is written. The route handler calls `schema.safeParse(body)` and returns a 400 with field errors on failure.

### Pattern: @ko/db singleton

Never import `PrismaClient` directly. Always import `prisma` from `@ko/db` (which manages the connection pool with `connection_limit=3`).

---

## 6. Dependency Graph — What Blocks What

```
W0 (schema + seed)
  │
  ├── W1 (lender select)      ← needs Lender table + seed live
  │
  ├── W2 (case overview)      ← needs CaseNote table + date fields on Case
  │   └── W6 radar            ← needs date spine fields from W2
  │
  └── W3 (property)          ← needs Property table
      └── W4 (stale)         ← needs propertyId on Case from W3
          └── W5 (info req)  ← needs stale logic stable; independent otherwise

W1 + W2 can overlap after W0 merges.
W3 can start on a branch as soon as schema is on main.
W6 radar queries can start once date fields exist (W2).
W6 FCA cron is independent of W1–W5 except it needs Lender table (W0).
```

---

## 7. Decisions Log

| Date | Decision | Owner | Status |
| :---- | :---- | :---- | :---- |
| 2026-09-21 | FINALISED suitability reports are never mutated when facts change | Product | Confirmed — implement in W4 |
| 2026-09-21 | Zero new nav items. Case is the hub. No new route group creates a top-level Lenders, Properties, or Tasks page | Product | Confirmed — backend routes are sub-resources only |
| 2026-09-21 | `Other` is a reserved lender row, not a sentinel string | Product | Confirmed — seed with `source = OTHER`, never deactivate |
| **2026-09-22** | **FCA bulk file vs Settings CSV fallback → Use FCA FS Register API (free, REST, JSON). Register at [register.fca.org.uk/developer/s/](https://register.fca.org.uk/developer/s/). Auth: `FCA_API_EMAIL` + `FCA_API_KEY` headers. Two-stage ingest: (1) verify existing lenders by FRN, (2) discover new mortgage lenders via keyword search + permission check. Implemented in `lib/api/lenders-fca-ingest.ts`.** | **Head of D&E + Backend** | **RESOLVED — implemented** |
| TBC | adviserNotes column — drop at which migration version | Head of D&E | Suggest: keep through W2 release, drop in W3 migration |

---

## 8. Effort Summary (Backend Only)

| Wave | Tasks | Total est. |
| :---- | :---- | :---- |
| W0 | Schema + seed + lender API + FCA spike | ~13 hrs |
| W1 | lenderId on products + unit tests | ~4 hrs |
| W2 | Notes API + date spine PATCH + adviserNotes migrate + GET extension | ~8 hrs |
| W3 | Property CRUD + case create extension + Intel preview fill | ~7 hrs |
| W4 | Stale detection + hooks into case/factfind + clear path + tests | ~10 hrs |
| W5 | Info-requests API + auto-fulfil on upload + compliance fulfil | ~7 hrs |
| W6 | Radar counts in bootstrap + cases filter + FCA cron | ~10 hrs |
| **Total** | | **~59 hrs** |

---

## 9. Acceptance Checklist (Backend Definition of Done per Wave)

### W0
- [ ] `pnpm db:migrate` runs clean on a fresh database
- [ ] `GET /api/lenders?q=clydes` returns one row: `{ name: "Clydesdale Bank PLC" }`
- [ ] `GET /api/lenders?q=Other` returns the Other sentinel row
- [ ] INACTIVE lenders do not appear in search results
- [ ] LEGACY lenders (Bradford & Bingley etc.) do appear in search results
- [ ] Seed is idempotent (running twice produces no duplicates)
- [ ] FCA spike note is written in Section 7 — Decisions of this document

### W1
- [ ] Creating a product with a valid `lenderId` succeeds; `lenderName` is derived from `lender.name`
- [ ] Creating a product with `lenderId = Other.id` without `lenderOtherName` returns a 400
- [ ] Selecting a product writes `Case.lenderId` (alongside existing `selectedLender` string)
- [ ] Unit tests pass: lender search, Other override, normalizedName uniqueness

### W2
- [ ] `POST /api/cases/:id/notes` creates a CaseNote; no update/delete routes exist
- [ ] `GET /api/cases/:id` response includes `notes[]` array
- [ ] PATCH on a case with `aipAt` or `offerExpiresAt` persists correctly
- [ ] `Case.adviserNotes` is no longer written by new code (only readable from old data)
- [ ] Intel copy-to-notes writes a `CaseNote` with `source: INTEL`
- [ ] adviserNotes backfill migration creates CaseNote rows for all non-empty cases

### W3
- [ ] `POST /api/clients/:id/properties` creates a Property and returns it
- [ ] `GET /api/clients/:id` includes `properties[]`
- [ ] Creating a case with `postcode` auto-creates a Property and sets `Case.propertyId`
- [ ] `GET /api/intelligence/cases/:id/preview` includes `postcode` from `Case.property` when available
- [ ] Property backfill migration runs without crashing on malformed JSON; skipped cases are logged

### W4
- [ ] Changing `loanAmount` on a case with a selected product sets `recommendationStaleAt`
- [ ] `SuitabilityReport` with `status = DRAFT` returns to DRAFT after a qualifying change (no-op if already DRAFT)
- [ ] `SuitabilityReport` with `status = FINALISED` is not touched
- [ ] Amending `incomeDetails` on a completed fact-find writes `FACT_FIND_AMENDED` audit event
- [ ] Re-selecting a product clears `recommendationStaleAt` and writes a CaseNote with `tag: amend`
- [ ] All 4 test files pass

### W5
- [ ] `POST /api/cases/:id/info-requests` creates an outstanding request and sends a message
- [ ] Uploading a document with matching `documentType` and `caseId` auto-fulfils the outstanding request
- [ ] Adviser completing a compliance checklist item fulfils matching requests
- [ ] `GET /api/cases/:id` includes `infoRequests[]` with `status = OUTSTANDING` items

### W6
- [ ] `GET /api/dashboard/bootstrap` includes `offersEnding14d` and `ratesEnding90d`
- [ ] `GET /api/cases?offerEndingWithinDays=14` returns only cases where `offerExpiresAt` is within 14 days
- [ ] `GET /api/cron/lenders-fca` returns 200 with `{ success: true }` (or 501 if FCA source not yet implemented)
- [ ] New FCA lender names appear in `GET /api/lenders` search after cron runs
- [ ] Previously active FCA lenders absent for 2 consecutive runs are set to INACTIVE
- [ ] INACTIVE lenders still appear on existing ProductConsidered rows (no cascade delete)
