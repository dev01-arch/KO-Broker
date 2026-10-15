# PRD-16 frontend tasks

**Project:** KO Broker Platform  
**PRD:** PRD-16 — Deepening KO Modules (Case Journey, Book of Business & Lender Directory)  
**Source:** `apps/web/PRD-16 Deepening KO Modules.pdf` (v1.0, 15 September 2026)  
**Audience:** PM / Frontend eng, UI/UX eng  
**Status:** Extracted for implementation. W0 (schema + lender seed) is backend and blocks W1.

This document is the frontend workstream only. It does not replace the PRD. Schema, APIs, cron, and stale-rule handlers stay with Backend.

---

## Constraints (every ticket)

1. **The Case is the record.** Overview, Cases, Client, and Mortgage Intel all open the same Case.
2. **Accordions, not tabs.** Date spine, account, notes, property, and products considered fold onto Case Overview.
3. **No new sidebar item, no new Case tab.** Reject any ticket that wants Mortgages, Properties, Tasks, or Lenders in nav.
4. **Intel does not own the deal.** It pre-fills from Case + Property and writes back via copy-to-notes.
5. **Stale beats silent.** If facts move after a recommendation, the UI says so.
6. **Existing tokens only.** Use `context/ui-context.md`. No new colourways. Stale banner uses existing amber / stage tokens.
7. **Fold into the live Case UI.** Do not rewrite the iframe shell. Case detail lives in `apps/web/public/live-demo-prototype-v2a.html` plus the bridge in `apps/web/components/marketing/live-demo-page.tsx`. Mortgage Intel and calculators are already React beside the iframe — follow that pattern.
8. **Waves, not a big-bang.** One PR per workstream slice. Branch `feature/PRD-16-w1-lender-select`. Do not open W4 until W1 + W2 are on main.
9. **Definition of done (PRD-00):** `pnpm typecheck` and `pnpm lint` pass; component renders without console errors; tested at 375px and 1280px; PR links to workstream ID (W0–W6).

---

## Current state (gap)

Nothing from W1–W6 is in the UI yet.

| PRD need | Today |
|---|---|
| Lender directory select | Free-text `lenderName` in `mountResearchProductsPanel` (`live-demo-page.tsx`) |
| `GET /api/lenders` | Does not exist. Schema has unused `LenderCriteria`, no `Lender` model |
| Products on Overview | Products panel is injected into **Compliance** (`.cd-comp-card`) |
| Date spine / account strip / notes thread | Single `Case.adviserNotes` string; Intel copy-to-notes overwrites it |
| Property on Client + postcode at create | New-case modal has client, type, value, loan, term — **no postcode**. Intel reads postcode from fact-find JSON |
| Stale recommendation / Amend | PATCH overwrites silently; no banner |
| Request from client | Checklist/docs have no Request action |
| Radar stats | Overview shows pipeline KPIs only |

**Primary UI surface:** `apps/web/public/live-demo-prototype-v2a.html` + bridge in `apps/web/components/marketing/live-demo-page.tsx`.  
**React already:** Mortgage Intel (`apps/web/components/dashboard/intelligence/case-intelligence.tsx`).  
**Missing primitives:** `apps/web/components/ui/` has no shadcn Command/Popover yet.

---

## Sequence

| Wave | Frontend ships when | Blocked by |
|---|---|---|
| **W0** | *No UI.* Seeded list live in API. | — |
| **W1** | Adviser searches “Clydesdale”, adds 3 products, selects one — still on the case. | W0 `GET /api/lenders` + `lenderId` on products |
| **W2** | A Research case shows products and notes on Overview, not only Compliance. | W1 (products panel exists); Backend CaseNote + date fields |
| **W3** | New case with postcode → Intel confirm-from-case does not re-ask. | Backend Property + `Case.propertyId` |
| **W4** | Change loan → banner → in-flight report is draft. Re-select clears stale. | **W1 + W2 on main** |
| **W5** | Request payslips → outstanding until upload. | Backend info-requests; reuse PRD-10 send path |
| **W6** | Overview shows ending offers; clicking filters Cases. | W2 date spine |

W1 and W2 overlap after W0. W3 can start as soon as Property migrate is on a branch. W6 can start whenever dates exist (W2).

**Do not cut W1 or W4.** Cut order if time runs out: W6 FCA cron (keep seed) → W6 radar → W5 request-info → charge type / offset fields.

---

## W1 — Lender select (P0) — first frontend work

Stop typing lender names. Same case, same 3+1+notes gate. The adviser searches a list (Clydesdale, NatWest, Skipton) with an Other escape hatch.

| Task | Owner | Est. | P |
|---|---|---|---|
| Searchable select component (shadcn Command/Popover), Other flow | UI/UX + PM/FE | 4 hrs | P0 |
| Products considered: replace text input; POST `lenderId` | PM/FE | 4 hrs | P0 |
| Existing-mortgage lender in fact-find uses same select | PM/FE | 2 hrs | P1 |
| Product fields: `productType`, `initialTermMonths`, `ercSummary` | Backend + PM/FE | 3 hrs | P1 |

**UI contract:** typeahead, keyboard, “Other…” last. Same component on Products considered and Case selected lender. Mobile 375px — full-width sheet if the popover overflows.

### Implementation notes (Step 1)

W0 (`GET /api/lenders?q=`, `lenderId` on products) is not in the repo. The select can be built against a stub; it cannot ship until that API exists.

**1a. Shared `LenderSelect`**

Intel already sits as React *beside* the iframe. Products/fact-find live *inside* the iframe as HTML. Practical approach:

- Build `LenderSelect` as a React component (Command + Popover, tokens, Other flow).
- Mount it with `createRoot` into an iframe placeholder (`<div data-ko-lender-select>`) from `live-demo-page.tsx` — same injection pattern as the products panel, but React instead of innerHTML.
- Query `GET /api/lenders?q=` (debounce, limit 20). Always show **Other…** last.
- Other → `lenderId` of the reserved Other row + `lenderOtherName` text.

Suggested props: `value: { lenderId, lenderOtherName? }`, `onChange`, `disabled`.

**1b. Wire Products considered**

In `mountResearchProductsPanel` (`live-demo-page.tsx`, ~line 3423), replace:

```html
<input data-ko-prod="lender" type="text" placeholder="e.g. NatWest" />
```

with the select. `casesApi.createProduct` currently sends `lenderName`. After W0 types land, send `lenderId` (+ `lenderOtherName` when Other). Keep product name / rate / fee / selected checkbox and the 3+1+notes gate.

**1c. Same component on fact-find (P1)**

Prototype field `existingMortgageLender` in `live-demo-prototype-v2a.html` (~line 9673) — swap that text input for the same select.

**W1 acceptance**

- Typing “clydes” returns Clydesdale Bank PLC, not a typed string.
- Keyboard works; Other is last; 375px uses a full-width sheet if needed.
- Adding 3 products + selecting one still unlocks Research → DIP.
- **Fail if** the lender field is still a free-text box.

**Branch:** `feature/PRD-16-w1-lender-select`

---

## W2 — Case Overview accordions (P0)

Put the recommendation where the adviser already looks. Fold date spine, account strip, notes thread, and products onto Overview. Compliance still advances the stage.

| Task | Owner | Est. | P |
|---|---|---|---|
| Accordion layout on Case Overview (tokens, 375/1280) | UI/UX + PM/FE | 6 hrs | P0 |
| PATCH date spine + account strip, edit-in-place | PM/FE | 4 hrs | P0 |
| Notes thread: `GET/POST /api/cases/:id/notes`; Intel copy-to-notes writes `CaseNote` | PM/FE (API is Backend) | 4 hrs | P0 |
| Move products panel onto Overview for Fact-Find/Research (keep gate) | PM/FE | 4 hrs | P0 |
| Do not remove Compliance advance; keep checklist in sync | PM/FE | 2 hrs | P0 |

**Accordions (visible when relevant):**

- **Details** — editable (loan, value, term, LTV)
- **Property** — pointer to Client-owned property
- **Dates** — AIP, submitted, offer issued, offer end, exchange, completion
- **Account** — rate type, monthly payment, initial-rate end; optional charge type / offset
- **Products considered** — when stage is `FACT_FIND` or `RESEARCH`, or `products.length > 0`
- **Notes** — timestamped thread (who, when, optional tag). Insert-only.

**W2 acceptance**

- Open a Research case: products and notes on Overview, not only Compliance.
- 375px: accordions stack. 1280px: layout holds.
- **Fail if** products are only visible inside Compliance.

**Branch:** `feature/PRD-16-w2-case-overview`

---

## W3 — Property + postcode at case create (P0)

Remember the home. Promote property off fact-find JSON onto the Client. Case holds `propertyId`. There is still no Properties item in the sidebar.

| Task | Owner | Est. | P |
|---|---|---|---|
| New case modal: postcode + optional address; LTV unchanged | PM/FE | 3 hrs | P0 |
| Client detail: property card (list, add) | UI/UX + PM/FE | 3 hrs | P0 |
| Intel preview reads `Property.postcode` (confirm-from-case does not re-ask) | PM/FE wiring; fill is Backend | 2 hrs | P0 |

Today the new-case modal (`submitNewCaseLive` in the prototype) sends client, type, `propertyValue`, `loanAmount`, `termYears` — no postcode. Intel (`case-intelligence.tsx`) currently extracts postcode from fact-find / client address blobs.

**W3 acceptance**

- Create a case with postcode → Mortgage Intel confirm-from-case does not re-ask.
- Remortgage on the same client can reuse the home.
- **Fail if** Intel asks for a postcode already on the case.

**Branch:** `feature/PRD-16-w3-property`

---

## W4 — Amend and stale (P0)

Do not open until W1 + W2 are on main. Let facts move without fabricating facts.

| Task | Owner | Est. | P |
|---|---|---|---|
| Overview + AI Report banner; re-select clears stale | PM/FE | 3 hrs | P0 |
| Fact-find Amend confirm + audit (`logAuditEvent`) | PM/FE | 3 hrs | P0 |

**Banner:** amber, existing stage tokens, copy: “Facts changed since this product was selected.” Primary action: **Review products**.

**Amend confirm:** “This will be audited. If a product is already selected, the recommendation may be marked stale.” Entry on Overview and Fact-find header.

**Clearing stale:** adviser re-selects a product (same or new) and confirms. Writes a `CaseNote` with tag `amend`.

**Do not mutate** `APPROVED` / `FINALISED` suitability reports. In-flight `DRAFT` / `ADVISER_REVIEW` return to `DRAFT`. Adviser generates a new report.

**W4 acceptance**

- Edit loan on Overview → banner; FINALISED reports unchanged; in-flight reports back to draft.
- Amend income on a completed fact-find → audit row exists.
- Re-select a product → stale clears; a note records the amend.
- **Fail if** changing loan silently leaves the old recommendation looking current.

**Branch:** `feature/PRD-16-w4-amend-stale`

---

## W5 — Request from client (P0)

Ask for the missing piece so Compliance can see it. Messages remains the inbox. No new Tasks module.

| Task | Owner | Est. | P |
|---|---|---|---|
| Request action on checklist + documents row; pre-filled composer | UI/UX + PM/FE | 5 hrs | P0 |
| Outstanding state in Compliance UI | PM/FE | 2 hrs | P0 |

**Composer pre-fill:** “Please upload 3 months’ payslips for {case ref}”. Uses PRD-10 send path (message / email / SMS, portal deep link when the client has access).

Item stays outstanding until a matching file is uploaded or the adviser confirms.

**W5 acceptance**

- Request payslips from a checklist/document row; item is outstanding; upload fulfils it; a message exists in the thread.
- Works for portal and no-portal clients (invite vs email body).
- **Fail if** Compliance is unaware of the document request.

**Branch:** `feature/PRD-16-w5-request-from-client`

---

## W6 — Radar (P1)

Two useful numbers on the Overview the adviser already has. Clicking either filters the Cases list. Not a new dashboard of earnings charts.

| Task | Owner | Est. | P |
|---|---|---|---|
| Overview counts + Cases filter (`offerExpiresAt`, `initialRateEndsAt`) | PM/FE | 4 hrs | P1 |
| Two Overview stat cards | UI/UX + PM/FE | 2 hrs | P1 |

**Cards only:**

1. Offers ending in 14 days
2. Product-rate periods ending in 90 days

Skip earnings donuts, lead-source charts, and insurance counts.

**W6 acceptance**

- Overview shows ending offers; click filters Cases.
- **Fail if** this becomes a new dashboard or a new nav item.

**Branch:** `feature/PRD-16-w6-radar`

FCA cron / Settings CSV import is Backend (same wave). Frontend only owns the two cards + Cases filter.

---

## Journey acceptance (frontend-visible)

### Journey 1 — new case to recommendation

An adviser can, without leaving the Case and without typing a lender from memory:

1. Create a client and a case with postcode (and optional property value / loan / term).
2. Complete disclosure (existing checklist).
3. Complete or invite fact-find (existing wizard).
4. Open Mortgage Intel on that case and see postcode pre-filled from the property.
5. On Case Overview, add three products via lender select, mark one recommended, write a note in the thread.
6. Advance Research → DIP with the existing 3+1+notes gate.
7. Generate, edit, and approve a suitability report that names the selected lender correctly.

**Fail if:** lender is still a free-text box; products are only visible inside Compliance; Intel asks for postcode already on the case.

### Journey 2 — existing case

1. Find the case from Cases (and, after W6, from an Overview ending-soon stat).
2. Edit loan amount on Overview; see stale banner; FINALISED reports unchanged; in-flight reports back to draft.
3. Amend an income field on a completed fact-find; audit row exists.
4. Request payslips from a checklist/document row; item is outstanding; upload fulfils it; a message exists in the thread.
5. Re-select a product; stale clears; a note records the amend.

**Fail if:** the adviser must open a second “mortgage” record; Compliance is unaware of the document request; changing loan silently leaves the old recommendation looking current.

---

## Suggested build order

1. **W0 check** — confirm `GET /api/lenders` + `lenderId` on POST products (backend). If missing, that is the first PR (`feature/PRD-16-w0-schema-seed`).
2. **W1** — `LenderSelect` + swap products box (`feature/PRD-16-w1-lender-select`).
3. **W2** — Overview accordions + move products/notes.
4. **W3** → **W4** → **W5** → **W6**.

---

## Out of scope (do not build)

- New top-level nav (Mortgages, Properties, Tasks, Lenders, Insurance)
- Live lender product ranking / sourcing engine
- Solicitor, direct debit, commission, bank details
- Partner CRM / introducer payments
- Cloning Mortgage Intel into a form freeze
- Joint applicant as a second Client row
- Rewriting the iframe live-demo shell
- Insurance module, payments, mailshots, document-template WYSIWYG, commercial property registers, 30-column mortgage grid, pink read-only snapshot page
