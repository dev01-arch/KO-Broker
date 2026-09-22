# PRD-16 Frontend Handover

## Case Journey, Book of Business & Lender Directory

| Field | Detail |
| :---- | :---- |
| **Document type** | Frontend Engineering Handover |
| **Backend status** | Complete — all 54 validation checks passed |
| **Prepared by** | Backend Engineer (Luxcity Technology) |
| **Date** | 22 September 2026 |
| **PRD** | PRD-16 v1.0 |
| **Builds on** | PRD-06 (CRM), PRD-07 (compliance), PRD-08 (fact-find), PRD-09 (AI reports), PRD-10 (messages), PRD-13 (portal), PRD-15 (Mortgage Intel) |

---

## What Was Built

Seven workstreams shipped. **No new top-level sidebar items. No new Case tabs.** Everything folds onto existing surfaces.

| Workstream | What changed | Surface |
| :---- | :---- | :---- |
| **W0** | 189-lender directory, `GET /api/lenders` search | New endpoint |
| **W1** | `lenderId` FK on products replaces free-text lender | Products panel |
| **W2** | Append-only notes thread, date spine + account strip on Case | Case Overview |
| **W3** | Property CRUD on Client, postcode at case create, Intel preview fill | Client detail + case create modal |
| **W4** | Stale recommendation detection, fact-find Amend, FINALISED report protection | Case Overview + AI Report tab |
| **W5** | Request from client → outstanding until upload or checklist complete | Compliance panel + Documents |
| **W6** | Radar stat cards on Overview, Cases date filter, FCA cron monthly | Overview + Cases list |

---

## Design Principle (applies to every ticket)

**The Case is the hub.** Overview, Cases, Client, and Mortgage Intel all open the same Case. Accordions, not tabs. Intel does not own the deal. Stale beats silent.

---

## New API Endpoints

All endpoints require a valid Clerk session cookie (`__session`). All return `{ success: true, data: ... }` on success and `{ success: false, error: { code, message, fields? } }` on failure.

### W0 — Lender Directory

#### `GET /api/lenders?q={query}`

Returns up to 20 lenders matching the query. The `Other` sentinel is always appended last.

```
Query params:
  q  string (optional) — partial name match, case-insensitive

Response:
  data: Array<{
    id: string
    name: string
    normalizedName: string
    status: 'ACTIVE' | 'INACTIVE' | 'LEGACY'
    source: 'SEED' | 'FCA' | 'OTHER'
  }>
```

**UI rules:**
- Use as a typeahead/searchable select on every lender input field
- `INACTIVE` lenders are excluded from results — they will never appear
- `LEGACY` lenders (Bradford & Bingley, NRAM, etc.) DO appear — advisers need them for remortgage files
- `Other` is always the last option regardless of search query. When selected, show a free-text input for `lenderOtherName`
- The `id` from this response is what you send as `lenderId` when creating/updating a product

---

### W2 — Case Notes

#### `GET /api/cases/:id/notes`

Returns all notes for a case, oldest first.

```
Response:
  data: Array<{
    id: string
    caseId: string
    body: string
    tag: string | null        // 'intel' | 'disclosure' | 'amend' | 'system' | null
    source: 'ADVISER' | 'INTEL' | 'SYSTEM'
    authorUserId: string | null
    author: { id, firstName, lastName } | null
    createdAt: string         // ISO 8601
  }>
```

#### `POST /api/cases/:id/notes`

Appends a new note. **No PATCH or DELETE endpoints exist — notes are permanent.**

```
Body:
  body: string (required, min 1 char)
  tag:  string (optional) — use 'disclosure', 'amend', or leave null

Response: HTTP 201 + the created note object
```

**UI rules:**
- Render as a chronological thread under Case Overview
- `source: 'INTEL'` notes have a Mortgage Intelligence tag badge — show them differently (e.g. teal/blue accent)
- `source: 'SYSTEM'` notes with `tag: 'amend'` are stale events — show them with the amber stale colour token
- `source: 'ADVISER'` notes are standard adviser entries
- The thread must not have an edit or delete button. It is append-only by design (compliance requirement).
- When an adviser clicks "copy to notes" in Intel, a new `INTEL` note appears in this thread automatically

---

### W3 — Properties

#### `GET /api/clients/:id/properties`

Returns all properties for a client.

```
Response:
  data: Array<{
    id: string
    clientId: string
    postcode: string
    address: object | null
    type: 'RESIDENTIAL' | 'BTL' | 'OTHER'
    tenure: string | null
    currentValue: number | null
    monthlyRent: number | null     // BTL only
    createdAt: string
    updatedAt: string
  }>
```

#### `POST /api/clients/:id/properties`

Creates a new property on the client.

```
Body:
  postcode:     string (required, min 2, max 10 — auto-uppercased)
  address:      object (optional) — same shape as existing address JSON
  type:         'RESIDENTIAL' | 'BTL' | 'OTHER' (optional, defaults RESIDENTIAL)
  tenure:       string (optional) — e.g. 'Freehold', 'Leasehold'
  currentValue: number (optional, positive)
  monthlyRent:  number (optional, non-negative — BTL only)

Response: HTTP 201 + the created property
```

**UI rules:**
- Show on Client detail page as a collapsible property card section — **not** in the sidebar nav
- The "add property" button lives on the client detail, not on a Properties page
- When creating a new case via the case modal, add `postcode` as an optional field. If filled, a `Property` is auto-created and linked to `Case.propertyId`
- If `Case.propertyId` is already set (remortgage on same home), surface a "use existing property" option in the case modal by listing `client.properties`

---

### W5 — Request from Client

#### `GET /api/cases/:id/info-requests`

Returns all info requests for a case (all statuses).

```
Response:
  data: Array<{
    id: string
    caseId: string
    clientId: string
    checklistItemId: string | null
    documentType: string | null     // matches DocumentType enum
    messageId: string | null
    status: 'OUTSTANDING' | 'FULFILLED' | 'CANCELLED'
    fulfilledDocumentId: string | null
    createdAt: string
    fulfilledAt: string | null
  }>
```

#### `POST /api/cases/:id/info-requests`

Sends a "Request from client" message and creates an outstanding request. The message uses the existing PRD-10 broadcast path (email/SMS/IN_APP).

```
Body:
  documentType:    string (optional) — one of: ID | INCOME | FINANCIAL | LENDER | COMPLIANCE | OTHER
  checklistItemId: string (optional) — compliance checklist item ID
  body:            string (optional) — custom message body override
  channel:         'EMAIL' | 'SMS' | 'IN_APP' (optional — uses org settings if omitted)

Validation: at least one of documentType or checklistItemId is required

Response: HTTP 201 + { infoRequest: {...}, delivery: { inApp, email, sms } }
```

**UI rules:**
- Add a **"Request from client"** button on each compliance checklist row and each document type row
- The button prefills a message composer using the document type or checklist item label
- After sending, show the row in an "Outstanding" state with a clock/pending badge
- The outstanding state clears automatically when the client uploads a matching document (auto-fulfilled server-side) or when the adviser marks the checklist item complete
- `GET /api/cases/:id` includes `infoRequests[]` with only `status: 'OUTSTANDING'` entries — use this for the badge count on the compliance panel
- To see the full history (including FULFILLED), use `GET /api/cases/:id/info-requests`

---

## Modified Endpoints — What Changed

### `GET /api/cases/:id` — Case detail

The response now includes three additional top-level arrays and several new fields.

**New fields on the case object:**

```typescript
// Property link (W3)
propertyId: string | null
property: { postcode: string } | null  // available via relation

// Lender FK (W1)
lenderId: string | null
lenderOtherName: string | null

// Date spine (W2)
aipAt: string | null           // Agreement in Principle date
submittedAt: string | null
offerIssuedAt: string | null
offerExpiresAt: string | null
exchangeAt: string | null
completionAt: string | null

// Account strip (W2)
rateType: string | null        // e.g. 'Fixed', 'Tracker', 'Discount'
monthlyPayment: number | null
initialRateEndsAt: string | null
chargeType: string | null      // 'First' | 'Second'
isOffset: boolean | null

// Stale recommendation (W4)
recommendationStaleAt: string | null
recommendationStaleReason: string | null
```

**New arrays on the case object:**

```typescript
// Notes thread (W2)
notes: Array<{
  id, caseId, body, tag, source, authorUserId, author, createdAt
}>

// Outstanding info requests (W5) — OUTSTANDING only
infoRequests: Array<{
  id, clientId, checklistItemId, documentType, messageId,
  status, fulfilledDocumentId, createdAt, fulfilledAt
}>
```

**Products considered — new fields (W1):**

```typescript
productsConsidered: Array<{
  // existing
  id, caseId, lenderName, productName, rate, fee, isSelected, reasonNotSelected, createdAt
  // new
  lenderId: string | null
  lenderOtherName: string | null
  productType: string | null       // 'Fixed' | 'Tracker' | 'Discount' | 'Other'
  initialTermMonths: number | null
  ercSummary: string | null
}>
```

---

### `PATCH /api/cases/:id` — Case update

Accepts all new Case fields. Date spine fields accept ISO 8601 strings or `null` to clear.

```typescript
// New fields accepted (all optional, all nullable):
propertyId: string | null
lenderId: string | null
lenderOtherName: string | null
aipAt: string | null           // ISO 8601 datetime
submittedAt: string | null
offerIssuedAt: string | null
offerExpiresAt: string | null
exchangeAt: string | null
completionAt: string | null
rateType: string | null
monthlyPayment: number | null
initialRateEndsAt: string | null
chargeType: string | null
isOffset: boolean | null
```

**Stale side-effect:** If `loanAmount`, `propertyValue`, `termYears`, or `propertyId` changes and a product is already selected, `recommendationStaleAt` is set automatically (fire-and-forget — the case data is returned immediately, stale is set asynchronously within ~100ms).

---

### `POST /api/cases` — Case create

Two new optional fields:

```typescript
postcode: string (optional, auto-uppercased)
           // If provided, auto-creates a Property and links Case.propertyId

propertyId: string (optional)
           // If provided, validates it belongs to this client and links it
```

If both are provided, `propertyId` takes priority. If neither, `propertyId` stays null.

---

### `POST /api/cases/:id/products` — Create product

New fields accepted:

```typescript
lenderId:          string (optional)  — FK to Lender; takes priority over lenderName
lenderOtherName:   string (optional)  — required when lenderId = Other sentinel id
productType:       string (optional)  — 'Fixed' | 'Tracker' | 'Discount' | 'Other'
initialTermMonths: number (optional)  — integer, positive
ercSummary:        string (optional)  — free text

// Existing field now optional (backward compat):
lenderName: string (optional)  — use lenderId instead; lenderName auto-derived when lenderId is set
```

**Validation:** At least one of `lenderId` or `lenderName` is required. Returns HTTP 422 with `VALIDATION_ERROR` if neither is provided.

**Stale side-effect:** Selecting a product (`isSelected: true`) clears `recommendationStaleAt` if it was set.

---

### `PUT /api/cases/:id/fact-find` — Upsert fact-find

New field:

```typescript
isAmend: boolean (optional, default false)
```

Without `isAmend`, sending updates to a completed fact-find returns HTTP 403 with `"Use the Amend action"`. With `isAmend: true`, the update is allowed and writes a `FACT_FIND_AMENDED` audit event. If the amend touches `incomeDetails`, `expenditureDetails`, `propertyDetails`, or `existingMortgages`, `recommendationStaleAt` is set automatically.

**UI implementation:** The "Amend" action on the fact-find header should set `isAmend: true` in the request body. Show a confirmation dialog before amending a completed fact-find: *"This will be audited. If a product is already selected, the recommendation may be marked stale."*

---

### `GET /api/dashboard/bootstrap`

Two new top-level fields:

```typescript
offersEnding14d: number   // count of active cases with offerExpiresAt within 14 days
ratesEnding90d:  number   // count of active cases with initialRateEndsAt within 90 days
```

These power the two radar stat cards on the Overview. Clicking a stat card should filter `GET /api/cases` using the corresponding filter param.

---

### `GET /api/clients/:id`

New field:

```typescript
properties: Array<{
  id, postcode, address, type, tenure, currentValue, monthlyRent, createdAt, updatedAt
}>
```

---

### `GET /api/cases` — Cases list

New query params:

```
offerEndingWithinDays:  number (optional) — filter to cases where offerExpiresAt is within N days
rateEndingWithinDays:   number (optional) — filter to cases where initialRateEndsAt is within N days
```

Also: `offerExpiresAt` and `initialRateEndsAt` are now present on every case row in list responses (may be null).

---

## UI Contracts — What the Frontend Must Build

### Lender searchable select component

One shared component used everywhere a lender is typed:
- Typeahead search against `GET /api/lenders?q=`
- Keyboard navigable
- When "Other" is selected: show an additional text input for `lenderOtherName`
- Used on: Products considered panel, existing mortgage lender in fact-find

### Case Overview accordions

All fold onto Case Overview. No new Case tabs.

| Accordion | Fields | Visible when |
| :---- | :---- | :---- |
| **Details** (editable) | type, stage, propertyValue, loanAmount, ltv, termYears, assignedAdviser | Always |
| **Property** | Linked property card with postcode, type, value | `case.propertyId` is set |
| **Dates** | aipAt, submittedAt, offerIssuedAt, offerExpiresAt, exchangeAt, completionAt | Always (empty state if no dates) |
| **Account** | rateType, monthlyPayment, initialRateEndsAt, chargeType, isOffset | Always |
| **Products considered** | Products panel (lender select, rate, fee, term, ERC, select one) | Stage is FACT_FIND or RESEARCH, or `products.length > 0` |
| **Notes** | Append-only thread with source badges | Always |

### Stale recommendation banner

**Trigger:** `case.recommendationStaleAt !== null`

```
Colour: amber (warning token)
Text:   "Facts changed since this product was selected."
        "[reason from case.recommendationStaleReason]"
CTA:    "Review products" — scrolls to Products accordion
```

Show on: Case Overview AND the AI Report tab.

The banner disappears when the adviser re-selects a product (the API clears `recommendationStaleAt` atomically with the product selection).

### Amend fact-find flow

1. Adviser clicks **"Amend"** button on the completed fact-find
2. Show confirmation modal: *"This action will be recorded in the audit log. If a product is already selected, the recommendation may be marked stale. Continue?"*
3. On confirm: re-enable the fact-find form sections, send `isAmend: true` in the `PUT` body
4. If any qualifying sections changed and a product was selected, the stale banner will appear on Overview

### Request from client flow

1. Adviser clicks **"Request from client"** on a compliance checklist row or document type row
2. Open a message composer (pre-filled body, editable)
3. On send: `POST /api/cases/:id/info-requests` with `checklistItemId` or `documentType`
4. The row shows an **"Outstanding"** badge (clock icon) — sourced from `case.infoRequests[]`
5. The badge clears automatically when:
   - The client uploads a document with matching `documentType`
   - The adviser marks the checklist item complete via `POST /api/compliance/items`

### Overview stat cards (radar)

Two cards on the existing Overview:

```
Card 1: "Offers ending soon"
        Value: bootstrap.offersEnding14d
        Sub:   "within 14 days"
        Click: navigates to Cases list with ?offerEndingWithinDays=14

Card 2: "Rate periods ending"
        Value: bootstrap.ratesEnding90d
        Sub:   "within 90 days"
        Click: navigates to Cases list with ?rateEndingWithinDays=90
```

---

## Field-Level Notes

### lenderName vs lenderId

Both fields exist on `ProductConsidered` during the transition period:

- New products: send `lenderId`. The API derives `lenderName` automatically from the Lender row.
- Legacy products (created before W1): `lenderId` is null, `lenderName` is a plain string.
- The UI should always display `lenderName` (it's always populated). Use `lenderId` only for edit flows.
- When editing a legacy product to change the lender: send `lenderId` and the API updates both.

### Case.selectedLender vs Case.lenderId

Both exist during the transition:
- `selectedLender` is a plain string (legacy) — still written for backward compat
- `lenderId` is the FK — written alongside `selectedLender` when a product is selected
- For display: use `selectedLender` string (always populated on cases with a selected product)
- For lender identity: use `lenderId` to cross-reference against the lender directory

### CaseNote sources

| source | Means | Display |
| :---- | :---- | :---- |
| `ADVISER` | Written by an adviser (or backfilled from old adviserNotes) | Standard note |
| `INTEL` | Written by the Mortgage Intelligence copy-to-notes action | Mortgage Intel badge |
| `SYSTEM` | Written automatically by the platform (stale events, amend events) | System/automated badge |

### recommendationStaleAt

- Non-null = recommendation is stale. Show amber banner.
- Null = no stale flag. Banner hidden.
- Never shown to the client — adviser-facing only.
- Cleared atomically when a product is re-selected (same or different product).
- Not cleared by PATCH /api/cases/:id — only by product selection.

### InfoRequest status transitions

```
OUTSTANDING → FULFILLED  (auto on document upload or compliance item complete)
OUTSTANDING → CANCELLED  (manual — no API endpoint yet, available for future)
```

The UI only needs to show OUTSTANDING items. FULFILLED items can be shown in a history view via `GET /api/cases/:id/info-requests`.

---

## What Is NOT Yet Live (Out of Scope for PRD-16)

| Feature | Status |
| :---- | :---- |
| FCA lender sync (cron fills new lenders monthly) | Route exists, requires `FCA_API_EMAIL` + `FCA_API_KEY` env vars to be set |
| Joint applicant as second Client row | Deferred — still on fact-find applicant fields |
| LenderCriteria ranking (max LTV, income) | Table exists, no UI — later phase |
| Properties nav item | Deliberately excluded — properties only on client detail and case header |
| Tasks module | Explicitly out of scope — info requests cover the use case |
| adviserNotes column removal | Column kept readable for this release; stop writing to it (new code uses CaseNote) |

---

## Validation Results

All 54 backend checks passed on 22 September 2026:

| Workstream | Checks | Result |
| :---- | :---- | :---- |
| W0 Lender directory | 7 | ✓ All passed |
| W0 Schema new tables/columns | 8 | ✓ All passed |
| W1 Product lenderId FK | 10 | ✓ All passed |
| W2 Notes thread + date spine | 10 | ✓ All passed |
| W3 Property | 5 | ✓ All passed |
| W4 Stale recommendation | 8 | ✓ All passed |
| W5 ClientInfoRequest | 7 | ✓ All passed |
| W6 Radar counts + filter | 4 | ✓ All passed |
| Cleanup | 1 | ✓ Passed |
| **Total** | **54** | **0 failures** |

---

## Questions for the Frontend Team

These are decisions the frontend needs to make or confirm:

1. **Lender select component** — shared component (recommended) or per-context? The backend uses the same `GET /api/lenders` endpoint everywhere.

2. **Date spine edit UX** — inline date pickers on the Details accordion, or a modal? All 7 date fields + 5 account fields can be sent in a single `PATCH /api/cases/:id` call.

3. **Stale banner placement** — the PRD says "Case Overview AND AI Report tab". Should it also appear in the Case header/breadcrumb?

4. **Notes thread scroll** — the notes accordion on Case Overview should probably auto-scroll to the newest note after posting. Confirm expected behaviour.

5. **Amend gate** — the confirm dialog copy is in this document. Frontend to confirm exact wording matches UX design.

6. **Request from client** — the pre-filled message body currently uses `documentType` or `checklistItemId` label + case reference number. If advisers want a richer default template, that can be changed server-side without a schema change.

7. **Radar stat cards placement** — PRD says two cards on the existing Overview. Exact position in the layout is a UI/UX decision.

---

## Contact

Backend engineer on this PRD: Luxcity Technology  
PRD-16 documents: `Doc/PRD-16-Backend-Engineering-Plan.md`, `Doc/PRD-16-Build-Tasks.md`  
Phase test guides: `Doc/PRD-16-Phase{1-7}-Test-Guide.md`  
Deployment guide: `Doc/PRD-16-Cron-Deployment-Guide.md`
