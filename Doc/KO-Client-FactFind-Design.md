# KO Client Portal — Fact-Find Form Design Spec

> **Source of truth:** Live demo fact-find wizard in `apps/web/public/live-demo-prototype-v2a.html` (`#ff-overlay`, `FF_SG`, `FF_Q`, lines ~1055–5930).  
> **Client route:** `/application` (`My Application`) — embedded inside the dashboard shell (sidebar stays visible).  
> **Data contract:** `UpsertFactFindSchema` in `packages/types/src/index.ts` + `PUT /api/portal/cases/:id/fact-find` (broker API, future).

Use this when building the client fact-find in the **KO-Client** repo.

---

## 1. Visual reference

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [sidebar] │ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  progress bar (3px, top)                │
│           │ [KO] KO Platform                    Saving…    3 / 22        │
│           │ ─────────────────────────────────────────────────────────── │
│           │ (1)Personal — (2)Employment — (3)Income — … — (8)Vulnerability│
│           │         ↑ horizontal section pills (green active)            │
│           │                                                              │
│           │   PERSONAL                                          1 ›      │
│           │   › What is your full name?                                  │
│           │   Include legal name as it appears on your ID                │
│           │   [ Title ] [ First name ] [ Last name ]                     │
│           │                                                              │
│           │   [ Back ]              [ Continue → ]     Enter ↵           │
│           │                                                              │
│           │              ● ● ● ○ ○ ○ ○ ○ ○ ○ ○                           │
│           │                        dot pager + 3/22                      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Invite flow:** On first visit, the welcome/OTP modal overlays this page (dimmed). See **[KO-Client-FactFind-Modals-And-States.md](./KO-Client-FactFind-Modals-And-States.md)** for all modals, upload, and error states.

---

## 2. Client vs broker layout

| Aspect | Broker (live demo) | Client portal |
|--------|-------------------|---------------|
| Container | Full-screen `#ff-overlay` (`z-index: 500`) | Inline in `/application` `main` content |
| Sidebar | Hidden (overlay) | **Client sidebar visible** |
| Close button | Top-right `✕` → case detail | **No close** — nav via sidebar |
| Entry | "Launch Fact Find form" on case | Overview CTA / invite completion |
| Adviser-only fields | `adviserNotes`, override vulnerability | **Omit** |
| Auto-fill float | Left-edge upload pill | Optional Phase 2 |
| API | `PUT /api/cases/:id/fact-find` | `PUT /api/portal/cases/:id/fact-find` |

---

## 3. Wizard shell structure

### 3.1 Regions (top → bottom)

| Region | ID / class | Spec |
|--------|------------|------|
| Progress bar | `#ff-progress-outer` / `#ff-progress-inner` | Fixed top, `3px` height; fill `#0F6E56`; width = `(currentStep / totalSteps) × 100%` |
| Top bar | `#ff-topbar` | Logo + brand (left); save status + `N / Total` (right) |
| Section strip | `#ff-section-strip` | Horizontal scroll of 8 section pills + connectors |
| Question card | `#ff-card-area` / `#ff-card` | Max width `672px`, centred, slide animation |
| Dot pager | `#ff-dot-strip` | Centred dots; active = wide green pill `16×6px` |
| Actions | `#ff-action-row` | Back + Continue (+ optional Skip) |

### 3.2 Top bar

| Element | Spec |
|---------|------|
| Logo chip | `28×28px`, `border-radius: 8px`, `bg #0F6E56`, text "KO" |
| Brand | `14px` bold, `color: rgba(24,24,27,.5)` — "KO Platform" |
| Save status | `Saving…` amber `#f59e0b` → `Saved` green `#0F6E56` (clears after 2.5s) |
| Offline pill | Amber `#FFFBEB` border `#FCD34D` when offline |
| Page counter | `12px`, `color: rgba(24,24,27,.35)` — e.g. `3 / 22` |

### 3.3 Section strip (8 groups)

From `FF_SG` in live demo — use these labels in the client UI:

| # | Strip label (live demo) | Client-friendly alias (invite mockup) | DB JSON key (`FactFind`) |
|---|-------------------------|---------------------------------------|--------------------------|
| 1 | Personal | Pre-work | `personalDetails` |
| 2 | Employment | Employment | `employmentDetails` |
| 3 | Income | Income | `incomeDetails` |
| 4 | Commitments | Commitments | `expenditureDetails` |
| 5 | Property | Property | `propertyDetails` |
| 6 | Adverse Credit | Adverse Credit | (part of `personalDetails` or separate blob) |
| 7 | Goals | Docs / Goals | `clientPreferences` |
| 8 | Vulnerability | Relationship / Vulnerability | `clientPreferences` (vulnerability sub-object) |

**Pill states:**

| State | Classes | Appearance |
|-------|---------|------------|
| Active | `ff-sg-pill ff-active` | `bg #0F6E56`, white text, shadow |
| Done | `ff-sg-pill ff-done` | Green text, `bg rgba(15,110,86,.08)`, checkmark |
| Pending | `ff-sg-pill ff-pending` | `color: rgba(24,24,27,.3)` |

Connectors between pills: `20px × 1px` — green tint when done, grey `#e4e4e7` when pending.

### 3.4 Question card anatomy

```
┌─ ff-section-label ─────────────────────  PERSONAL  (11px uppercase teal)
│
├─ ff-q-row ─────────────────────────────  1 ›  Question title (28px bold)
├─ ff-q-sub ─────────────────────────────  Helper text (14px grey, ml 26px)
├─ ff-q-input ───────────────────────────  Field controls (ml 26px)
└─ ff-action-row ────────────────────────  Back | Continue | keyboard hint
```

**Animations:**
- Forward: `ff-slide-in` — `translateX(50px)` → 0
- Back: `ff-slide-back` — `translateX(-50px)` → 0
- Duration: `0.3s cubic-bezier(.34,1.56,.64,1)`

### 3.5 Dot pager

- Max **12 dots** shown; if more steps, `+N` overflow label
- Active: `16×6px` green `#0F6E56`
- Past: `6×6px` `rgba(15,110,86,.3)`
- Future: `6×6px` `#e4e4e7`

### 3.6 Completion screen

After final question:
- Green check icon in circle
- Title: "Fact-find complete"
- Summary rows (sections completed, case ref)
- CTA: "Return to overview" → `/overview`

---

## 4. Question flow (~22–52 cards)

Questions are **one card per screen** (not one card per section). Total visible count depends on conditional logic (`si` = show-if).

**Base flow (single applicant, purchase):** ~22 visible cards.  
**Joint applicant / remortgage / self-employed:** up to ~40+ cards.

### 4.1 Section breakdown (`FF_Q` ids)

#### Personal (9–14 cards)
| ID | Question | Type |
|----|----------|------|
| `c1-name` | Client 1 full name | `name-group` |
| `c1-dob` | Date of birth | `text` |
| `c1-nation` | Nationality + time in UK | `nationality-group` |
| `c1-addr` | Current address | `address-group` |
| `c1-rent` | Monthly rent | `currency` (if renting) |
| `c1-prev-addr` | Previous address | `address-group` (if < 3yr history) |
| `c1-marital` | Marital status | `pills` |
| `c1-contact` | Phone + email | `contact-group` |
| `c1-deps` | Dependants | `dependants-group` |
| `joint` | Second applicant? | `yesno` |
| `c2-*` | Client 2 personal fields | (if joint) |

#### Employment (3–5 cards)
| ID | Question | Type |
|----|----------|------|
| `c1-emp` | Employment status | `pills` (8 options) |
| `c1-employer` | Employer details | `employer-group` |
| `c1-contract` | Contract details | `contract-group` |
| `c2-emp` / `c2-employer` | Client 2 | (if joint) |

#### Income (4–6 cards)
| ID | Question | Type |
|----|----------|------|
| `c1-salary` | Gross annual salary | `currency` |
| `c1-ni` | NI number | `text` |
| `c1-sa302` | SA302 last 3 years | `sa302-group` (if self-employed) |
| `c1-bonus` | Additional income | `bonus-group` |
| `c2-*` | Client 2 income | (if joint) |

#### Commitments (2–3 cards)
| ID | Question | Type |
|----|----------|------|
| `fin-cards` | Credit cards | `credit-cards` (repeatable list) |
| `fin-loans` | Loans | `loans` (repeatable list) |
| `fin-mortgage` | Existing mortgage | `mortgage-group` (remortgage / flag) |

#### Property (6–8 cards)
| ID | Question | Type |
|----|----------|------|
| `prop-toggle` | Purchase vs existing | `pills` |
| `prop-values` | Value + mortgage + LTV | `property-value-group` |
| `prop-deposit` | Deposit source | `pills` |
| `prop-terms` | Term + repayment type | `property-terms-group` |
| `prop-type` | Property type | `pills` (10 options) |
| `prop-tenure` | Freehold / leasehold | `pills` |
| `prop-use` | Intended use | `pills` |
| `prop-purpose` | Purpose of loan | `pills` |
| `prop-rental` | Rental income | `currency` (BTL) |

#### Adverse Credit (3–5 cards)
| ID | Question | Type |
|----|----------|------|
| `ac-c1-missed` | Missed payments | `yesno-detail` |
| `ac-c1-ccj` | CCJ / IVA / bankruptcy | `yesno-detail` |
| `ac-c2-*` | Client 2 | (if joint) |
| `ac-insurance` | Insurance policies held | `insurance` (multi-select chips) |

#### Goals & Preferences (4 cards — client fills)
| ID | Question | Type |
|----|----------|------|
| `goals-main` | What are you looking to achieve? | `textarea` |
| `goals-future` | Expected future changes | `textarea` |
| `goals-matters` | What matters most about this mortgage? | `textarea` |
| `rate-prefs` | Rate + term preferences | `rate-prefs-group` |
| `pay-prefs` | Max monthly payment + risk | `payment-group` |
| ~~`adv-notes`~~ | ~~Adviser notes~~ | **Broker only — omit on client** |

#### Vulnerability (1 card)
| ID | Question | Type |
|----|----------|------|
| `vulnerability` | 6-domain questionnaire | `vulnerability` |

**Vulnerability scoring:** 6 domains × 2 questions × score 0–2. Total ≥ 16 → `isVulnerable` on client (broker backend writes flag). Client fills questions only — no adviser override UI.

---

## 5. Field component library

Mirror live demo CSS classes (`ff-*`). Implement as React components in `components/fact-find/`.

| Type | Class / pattern | Use |
|------|-----------------|-----|
| `text` | `ff-uinput-wrap` + underline input | DOB, NI number |
| `textarea` | `ff-utextarea` | Goals, free text |
| `currency` | `ff-uinput` + `£` prefix | Salary, rent, values |
| `pills` | `ff-pills-wrap` + `ff-pill` | Single/multi select chips |
| `yesno` | `ff-yesno-wrap` + `ff-yn` | Binary choices |
| `yesno-detail` | yesno + conditional `ff-detail-ta` | Adverse credit detail |
| `name-group` | `ff-grid-3` | Title, first, middle, last |
| `address-group` | `ff-grid-2` + postcode | Address lines, move-in date |
| `employer-group` | boxed inputs | Name, address, phone |
| `contract-group` | date + pills | Start date, contract type |
| `credit-cards` | `ff-list-card` + add button | Repeatable rows |
| `loans` | `ff-list-card` + add button | Repeatable rows |
| `mortgage-group` | boxed grid | Lender, balance, rate, ERC |
| `property-value-group` | currency fields + `ff-ltv-panel` | Auto LTV indicator |
| `rate-prefs-group` | pills | Fix / tracker / discount + period |
| `payment-group` | currency + pills | Max payment, risk appetite |
| `insurance` | `ff-ins-wrap` + `ff-ins-btn` | Multi-select capsules |
| `dependants-group` | `ff-dep-row` repeatable | Name, age, relationship |
| `vulnerability` | `ff-vuln-domain` accordion | 0/1/2 score buttons per question |

### Shared field styling

| Element | Spec |
|---------|------|
| Boxed input | `height: 40px`, `border-radius: 10px`, `border #e4e4e7` |
| Focus ring | `border #0F6E56`, `box-shadow: 0 0 0 3px rgba(15,110,86,.12)` |
| Invalid | `border #DC2626`, red shadow |
| Active pill | `bg #0F6E56`, white text |
| Yes button | `ff-yn-yes` green |
| No button | `ff-yn-no` red tint |
| Primary CTA | `ff-btn-ok` — `bg #0F6E56`, `border-radius: 12px` |
| Back button | `ff-btn-back` — outlined grey |

### LTV panel (property step)

| LTV | Panel class | Colour |
|-----|-------------|--------|
| ≤ 80% | `ff-ltv-ok` | Green |
| 80–90% | `ff-ltv-warn` | Amber |
| > 90% | `ff-ltv-danger` | Red |

---

## 6. Behaviour & UX rules

### 6.1 Navigation

- **Continue** validates current card → advances index
- **Back** decrements index (hidden/disabled on card 1)
- **Enter** submits (except in textarea)
- **ArrowUp** goes back
- Conditional questions: re-filter visible list when `hasJointApplicant`, employment status, etc. changes

### 6.2 Auto-save

```typescript
// Debounce 2000ms on any field change
onChange → debounce → PUT /api/portal/cases/:id/fact-find
  body: { personalDetails: {...}, ... }  // partial section merge

// UI feedback
'Saving…' (amber) → 'Saved' (green, 2.5s) → clear
```

Until API exists: persist to `sessionStorage` key `ko-portal-factfind-{caseId}`.

### 6.3 Validation

- Inline errors on blur (`ff-field-error`, `12px` red)
- Section cannot complete until required fields valid
- Alpha-only fields: firstName, lastName, employerName, city (letters only)
- Final submit: `markComplete: true` → sets `FactFind.completedAt` (broker API)

### 6.4 Client copy adjustments

Replace broker-centric copy with first-person client copy:

| Broker (live demo) | Client portal |
|--------------------|---------------|
| "What is Client 1's full name?" | "What is your full name?" |
| "Client 1's employment status" | "What is your employment status?" |
| "What can I help you with?" | "What are you hoping to achieve?" |
| "Adviser notes" | *(removed)* |

Pre-fill from invite: `firstName`, `lastName`, `email` from portal session.

---

## 7. Data model mapping

Prisma `FactFind` stores JSON blobs per section. Map wizard form state → API payload:

```typescript
// packages/types — UpsertFactFindSchema
{
  personalDetails?: Record<string, unknown>;      // names, DOB, addresses, dependants, adverse credit
  employmentDetails?: Record<string, unknown>;    // client1/2 employment
  incomeDetails?: Record<string, unknown>;        // salaries, SA302, bonus
  expenditureDetails?: Record<string, unknown>;   // credit cards, loans, mortgage commitments
  propertyDetails?: Record<string, unknown>;      // value, tenure, type, LTV
  existingMortgages?: Record<string, unknown>;    // existing mortgage block
  clientPreferences?: Record<string, unknown>;    // goals, rate prefs, vulnerability scores
  markComplete?: boolean;
}
```

**Suggested client form state shape** (mirror `ffInitForm()` in live demo):

```typescript
interface ClientFactFindForm {
  caseType: CaseType;
  hasJointApplicant: boolean;
  client1Personal: PersonalDetails;
  client2Personal?: PersonalDetails;
  client1Employment: EmploymentDetails;
  client2Employment?: EmploymentDetails;
  client1Income: IncomeDetails;
  client2Income?: IncomeDetails;
  creditCards: CreditCardRow[];
  loans: LoanRow[];
  hasExistingMortgage: boolean;
  existingMortgage: ExistingMortgageDetails;
  property: PropertyDetails;
  adverseCredit: AdverseCreditDetails;
  preferences: ClientPreferences;
  vulnerabilityScores: VulnerabilityDomain[];  // 6 × { q1, q2 }
}
```

Serialize to section keys before each auto-save `PUT`.

---

## 8. File structure (KO-Client repo)

```
apps/client/
├── app/(dashboard)/application/
│   └── page.tsx                    # FactFindWizard page
├── components/fact-find/
│   ├── fact-find-wizard.tsx        # Shell: progress, strip, card, dots
│   ├── fact-find-section-strip.tsx
│   ├── fact-find-question-card.tsx
│   ├── fact-find-dot-pager.tsx
│   ├── fact-find-save-status.tsx
│   ├── fact-find-completion.tsx
│   ├── fields/
│   │   ├── ff-pills.tsx
│   │   ├── ff-yes-no.tsx
│   │   ├── ff-currency-input.tsx
│   │   ├── ff-address-group.tsx
│   │   ├── ff-repeatable-list.tsx
│   │   ├── ff-ltv-panel.tsx
│   │   └── ff-vulnerability.tsx
│   └── questions/
│       ├── question-registry.ts    # Port FF_Q definitions
│       └── use-fact-find-navigation.ts
├── hooks/
│   └── use-fact-find.ts            # React Query + auto-save
└── lib/fact-find/
    ├── form-state.ts               # ffInitForm, ffGet, ffSet
    ├── serialize.ts                # form → UpsertFactFindInput
    └── validation.ts               # per-card Zod schemas
```

---

## 9. Reference component skeleton

```tsx
'use client';

export function FactFindWizard({ caseId }: { caseId: string }) {
  const { form, updateField, save, isSaving, saveLabel } = useFactFind(caseId);
  const { visibleQuestions, index, goNext, goBack, sectionGroups, progressPct } =
    useFactFindNavigation(form);

  const current = visibleQuestions[index];

  return (
    <div className="relative flex min-h-full flex-col bg-[#FAFBFC]">
      {/* Progress bar */}
      <div className="fixed top-0 right-0 left-0 z-50 h-[3px] bg-[#e4e4e7] lg:left-[254px]">
        <div className="h-full bg-brand-teal-700 transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[#e4e4e7]/60 bg-white/95 px-6 py-3 pt-4 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-teal-700 text-[11px] font-bold text-white">KO</div>
          <span className="text-sm font-bold text-zinc-500">KO Platform</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <FactFindSaveStatus label={saveLabel} saving={isSaving} />
          <span>{index + 1} / {visibleQuestions.length}</span>
        </div>
      </header>

      <FactFindSectionStrip groups={sectionGroups} currentSection={current?.section} />

      <div className="mx-auto w-full max-w-[672px] flex-1 px-6 py-8">
        <FactFindQuestionCard
          key={current.id}
          question={current}
          form={form}
          onChange={updateField}
          onNext={goNext}
          onBack={goBack}
          isFirst={index === 0}
          isLast={index === visibleQuestions.length - 1}
        />
      </div>

      <FactFindDotPager total={visibleQuestions.length} current={index} />
    </div>
  );
}
```

**Progress bar offset:** `lg:left-[254px]` so it spans main content only (not sidebar).

---

## 10. API integration

| Action | Endpoint | Body |
|--------|----------|------|
| Load existing | `GET /api/portal/cases/:id` | Response includes `factFind` |
| Auto-save | `PUT /api/portal/cases/:id/fact-find` | Partial `UpsertFactFindInput` |
| Complete | `PUT /api/portal/cases/:id/fact-find` | All sections + `markComplete: true` |

**Mock mode:** `lib/api/portal-data.ts` returns pre-filled partial fact-find for dev.

---

## 11. Colours & typography

| Role | Value |
|------|-------|
| Page background | `#FAFBFC` |
| Primary green | `#0F6E56` (buttons, progress, active section) |
| Question title | `28px` bold `#18181b` |
| Section label | `11px` uppercase `rgba(15,110,86,.6)` |
| Body / hints | DM Sans `14px` `#71717a` |
| Headings | Syne |

Copy `ff-*` CSS from `live-demo-prototype-v2a.html` lines 1055–1297 into `apps/client/app/fact-find.css` or convert to Tailwind `@layer components`.

---

## 12. Client-specific omissions

| Feature | Include? | Spec |
|---------|----------|------|
| Adviser notes (`adv-notes`) | No | — |
| Vulnerability adviser override | No | — |
| Auto-fill from document upload float | Phase 2 | [Modals doc](./KO-Client-FactFind-Modals-And-States.md) §6 |
| Close / escape to exit wizard | No (use sidebar) | — |
| Open Banking simulation banners | Rephrase for upload failure | [Modals doc](./KO-Client-FactFind-Modals-And-States.md) §8 |
| Report / notification toasts | No (broker-only) | [Modals doc](./KO-Client-FactFind-Modals-And-States.md) §11 |
| Upload modal + error states | Yes (P1) | [Modals doc](./KO-Client-FactFind-Modals-And-States.md) §5 |
| Missing fields modal | Yes (P1) | [Modals doc](./KO-Client-FactFind-Modals-And-States.md) §7 |
| Invite welcome + OTP modals | Yes (P0) | [Modals doc](./KO-Client-FactFind-Modals-And-States.md) §3–4 |

---

## 13. Acceptance criteria

- [ ] `/application` renders wizard inside dashboard shell (sidebar visible)
- [ ] 8-section strip matches live demo pill styles
- [ ] One question per card with slide transitions
- [ ] Dot pager + `N / Total` counter in top bar
- [ ] 2s debounced auto-save with Saving/Saved indicator
- [ ] Conditional questions (joint applicant, self-employed, BTL, etc.)
- [ ] LTV panel updates live on property values
- [ ] Vulnerability questionnaire (6 domains) without adviser override
- [ ] Completion screen redirects to `/overview`
- [ ] Form state maps to `UpsertFactFindSchema` section keys
- [ ] Client copy uses first-person ("your") not "Client 1"
- [ ] Works offline with mock/sessionStorage when `NEXT_PUBLIC_USE_MOCK_API=true`

---

## 14. Broker source files

| File | Content |
|------|---------|
| `apps/web/public/live-demo-prototype-v2a.html` | Full wizard HTML/CSS/JS (`FF_SG`, `FF_Q`, `ffRender`) |
| `packages/types/src/index.ts` | `UpsertFactFindSchema` |
| `Doc/KO_Modular_PRD_Set_v2.docx.md` | PRD-08 — 7-section field list |
| `apps/web/lib/api/cases.ts` | `serializeFactFind` response shape |
| `apps/web/app/api/cases/[id]/fact-find/route.ts` | Broker PUT handler (reference for portal route) |

---

*KO Client Portal · Fact-find spec · Aligns with live demo v2a wizard (PRD-08)*
