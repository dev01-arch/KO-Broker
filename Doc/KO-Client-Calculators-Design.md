# KO Client Portal — Mortgage Tools (Calculators) Design Spec

> **Source of truth:** `apps/web/components/marketing/demo-calculator/MortgageCalculators.tsx` (live demo) + PRD-11  
> **Client route:** `/tools` (sidebar label: **Mortgage Tools**)  
> **Backend API:** **None required** — calculators are pure client-side (no `/api/portal/*` routes)

Use this when building the calculators page in the **KO-Client** repo.

---

## 1. Overview

| Aspect | Detail |
|--------|--------|
| Purpose | Let clients explore mortgage numbers (affordability, stamp duty, payments, etc.) for **guidance only** |
| Nav item | Mortgage Tools → `/tools` |
| Calculator count | **8** (same as broker) |
| Data source | User inputs only; optional pre-fill from portal case |
| Auth | Standard portal session (page is behind `ClientAuthGuard`) |
| Plan gate | Feature `calculators` on org plan (all tiers include it per `@ko/types`) |

**Important:** Unlike messages or fact-find, **no backend ticket is needed** for calculators. Copy or share the React component + formulas from KO-Broker.

---

## 2. Layout (client portal)

The broker live demo uses an **inner sidebar** (calculator list) + main panel. The client app **already has** the dashboard sidebar — avoid a triple-column layout on desktop.

### Recommended layout

```
┌──────────────┬────────────────────────────────────────────────┐
│ Client nav   │  Mortgage Tools                                │
│ (254px)      │  Explore estimates to help you plan            │
│              │  ┌────┐ ┌────┐ ┌────┐ ┌────┐  ← 2×4 card grid │
│              │  │Aff │ │Pay │ │SD  │ │LTV │     (mobile: 2×4)│
│              │  └────┘ └────┘ └────┘ └────┘                   │
│              │  ┌──────────────────────────────────────────┐ │
│              │  │ [icon] Affordability Calculator          │ │
│              │  │ All results update in real-time          │ │
│              │  │ [inputs grid]                            │ │
│              │  │ [metric result cards]                    │ │
│              │  └──────────────────────────────────────────┘ │
│              │  [Disclaimer footer]                          │
└──────────────┴────────────────────────────────────────────────┘
```

**Desktop:** 4-column selection grid above active calculator (PRD-11 pattern from HTML prototype `.calc-grid`).  
**Mobile:** 2-column grid; calculator panel stacks below.

**Do not** duplicate the broker’s inner left nav (`lg:col-span-3` aside) unless viewport is very wide — use the **card grid** from `live-demo-prototype-v2a.html` instead.

### Page header

| Element | Spec |
|---------|------|
| Title | `Mortgage Tools` (Syne, `24px` bold) |
| Subtitle | `Explore estimates to help you plan your mortgage.` (DM Sans, `14px`, `#71717a`) |
| Background | `surface` (`#F7FBF9`) — match overview |

---

## 3. Calculator catalogue

Same 8 calculators as broker — IDs, colours, and icons from `MortgageCalculators.tsx`:

| ID | Name | Icon (Lucide) | Icon bg | Icon colour | Short description |
|----|------|---------------|---------|-------------|-----------------|
| `affordability` | Affordability | `Calculator` | `#d5fef0` | `#00bc7d` | Max loan from income |
| `monthly-payment` | Monthly Payment | `Home` | `#e5efff` | `#2B7FFF` | Repayment & interest-only |
| `stamp-duty` | Stamp Duty | `Stamp` | `#f0defe` | `#AD46FF` | UK SDLT bands |
| `ltv` | LTV | `Percent` | `#fff2de` | `#FE9A00` | Loan to value ratio |
| `erc` | ERC | `AlertCircle` | `#ffe6ec` | `#FF2056` | Early repayment charge |
| `rental-yield` | Rental Yield | `TrendingUp` | `#d4f7fe` | `#00B8DB` | Gross & net yield |
| `remortgage` | Remortgage Saving | `RefreshCw` | `#e3e3ff` | `#615FFF` | Rate switch saving |
| `debt-consolidation` | Debt Consolidation | `CreditCard` | `#ffdeef` | `#F6339A` | Monthly saving analysis |

### Selection card (grid item)

From HTML prototype `.calc-card`:

```css
background: var(--surface);
border: 1px solid rgba(13,31,26,0.12);
border-radius: 8px;
padding: 16px;
cursor: pointer;
```

**Active/hover:** `bg #E1F5EE`, `border-color #1D9E75`

Each card: coloured icon area + **name** (`13px` semibold) + **desc** (`11px` grey).

### Active calculator panel

| Region | Spec |
|--------|------|
| Header | Coloured icon box `40×40`, title `"{Name} Calculator"`, subtitle "All results update in real-time" |
| Body | `p-6` — inputs + metric cards |
| Footer | Disclaimer (see §8) |

---

## 4. Calculator specifications (inputs & outputs)

Port logic from `MortgageCalculators.tsx`. Eventually extract to `@ko/utils` or `packages/calculators` (PRD-11 target: `lib/calculators/formulas.ts`).

### 4.1 Affordability

| Input | Type | Default | Client label |
|-------|------|---------|--------------|
| Annual income | number | 50000 | Your annual income |
| Second income | number | 0 | Partner's income (optional) |
| Deposit | number | 50000 | Your deposit |
| Monthly commitments | number | 500 | Monthly debt repayments |
| Income multiplier | range 3–6 step 0.5 | 4.5 | Income multiplier |

| Output | Formula |
|--------|---------|
| Max borrowing | `(income + secondIncome) × multiplier` |
| Max purchase price | `maxBorrowing + deposit` |
| Affordability ratio | `monthlyCommitments × 12 / totalIncome` |

**Verify:** £72,000 × 4.5 = **£324,000** max borrowing.

---

### 4.2 Monthly payment

| Input | Default |
|-------|---------|
| Loan amount | 250000 |
| Annual rate % | 4.5 |
| Term (years) | 25 |
| Type | repayment \| interest-only |

| Output | Formula |
|--------|---------|
| Monthly payment | Standard amortisation (repayment) or `P × r/12` (I/O) |

---

### 4.3 Stamp duty (UK 2024, England)

| Input | Type |
|-------|------|
| Purchase price | number |
| First-time buyer | toggle |
| Buy-to-let / additional property | toggle (+3% all bands) |

**Bands (non-FTB):**

| Band | Rate |
|------|------|
| Up to £250,000 | 0% |
| £250,001 – £925,000 | 5% |
| £925,001 – £1,500,000 | 10% |
| Above £1,500,000 | 12% |

**FTB relief:** 0% up to £425,000; 5% from £425,001–£625,000; none above £625,000.

**Verify:** £500,000, not FTB, not BTL = **£12,500**.

---

### 4.4 LTV

| Input | Output |
|-------|--------|
| Loan amount, property value | LTV % = `(loan / value) × 100` |

Use `@ko/utils` → `calculateLTV(loan, value)`.

Colour bands (match fact-find `ff-ltv-panel`):

| LTV | Colour |
|-----|--------|
| ≤ 80% | Green |
| 80–90% | Amber |
| > 90% | Red |

---

### 4.5 ERC (Early repayment charge)

| Input | Output |
|-------|--------|
| Outstanding balance, ERC rate % | `balance × (rate / 100)` |

---

### 4.6 Rental yield

| Input | Output |
|-------|--------|
| Annual rent, property value, annual costs | Gross: `rent/value`; Net: `(rent−costs)/value` |

---

### 4.7 Remortgage saving

| Input | Output |
|-------|--------|
| Current rate, new rate, balance, term | Monthly diff × 12 = annual saving; total over term |

---

### 4.8 Debt consolidation

| Input | Output |
|-------|--------|
| Array of debts (balance + rate), new rate, new term | New monthly payment, monthly saving, total cost comparison |

---

## 5. UI components (reuse from broker)

Copy or symlink from KO-Broker:

| Component | Path |
|-----------|------|
| Main shell | `components/marketing/demo-calculator/MortgageCalculators.tsx` |
| Tooltip | `demo-calculator/components/ui/tooltip.tsx` |
| Utils | `demo-calculator/components/ui/utils.ts` |

**Shared subcomponents inside `MortgageCalculators.tsx`:**

- `FieldLabel` + `InfoTooltip` — client-friendly tooltips (already written for clients in affordability copy)
- `MetricCard` — gradient result cards with icon + value + subtext
- Recharts charts (stamp duty breakdown, debt comparison) — keep `recharts` dependency

### Client-specific copy changes

| Broker | Client |
|--------|--------|
| "Add to case note" | **Remove** (broker-only) |
| Technical adviser language | Plain English + `Info` tooltips |
| Default income from empty | Pre-fill from case when available (see §6) |

---

## 6. Optional case pre-fill

If `GET /api/portal/cases/:id` is available, seed inputs:

| Calculator | Pre-fill from case |
|------------|-------------------|
| Affordability | `annualIncome` from client profile |
| Monthly payment | `loanAmount`, `termYears` |
| LTV | `loanAmount`, `propertyValue` |
| Stamp duty | `propertyValue`, `type === 'BTL'` |

```typescript
// hooks/use-calculator-prefill.ts
export function useCalculatorPrefill() {
  const { data: caseDetail } = usePortalCase();
  return {
    loanAmount: caseDetail?.loanAmount,
    propertyValue: caseDetail?.propertyValue,
    termYears: caseDetail?.termYears,
    annualIncome: caseDetail?.client?.annualIncome,
    isBtl: caseDetail?.type === 'BTL',
  };
}
```

User can always override pre-filled values.

---

## 7. Behaviour rules (PRD-11)

| Rule | Implementation |
|------|----------------|
| Live updates | `useState` + derived values (or `react-hook-form` `watch()`) — **no submit button** |
| No API calls | All math in browser |
| Copy result | Optional P1 — `navigator.clipboard.writeText()` on metric card |
| Persistence | Do not save calculator inputs to DB |
| Accessibility | Labels on all inputs; tooltips keyboard-accessible |

---

## 8. Disclaimer (required footer)

Same text as broker `MortgageCalculators.tsx`:

> **Note:** These calculators provide estimates for guidance only. Actual figures may vary based on individual circumstances and lender criteria. Always consult with a qualified mortgage adviser for personalized advice.

Style: `bg-muted/50`, `rounded-lg`, `border`, `text-sm text-muted-foreground`.

For client portal, link "mortgage adviser" to `/messages` (optional).

---

## 9. File structure (KO-Client repo)

```
apps/client/
├── app/(dashboard)/tools/
│   └── page.tsx
├── components/calculators/
│   ├── mortgage-tools-page.tsx      # Page header + grid + panel wrapper
│   ├── calculator-grid.tsx          # 2×4 selection cards
│   ├── mortgage-calculators.tsx     # Port from broker (or import shared pkg)
│   └── calculators/
│       ├── affordability.tsx
│       ├── monthly-payment.tsx
│       └── ... (or keep single file like broker)
├── lib/calculators/
│   └── formulas.ts                  # Pure functions (share with broker)
└── hooks/
    └── use-calculator-prefill.ts    # Optional case pre-fill
```

### Recommended sharing strategy

| Option | Pros |
|--------|------|
| **A. Copy `MortgageCalculators.tsx` into client repo** | Fastest; no broker changes |
| **B. New `packages/calculators` in KO-Broker monorepo** | Single source; client submodule |
| **C. Publish `@ko/calculators` npm package** | Best long-term |

**Phase 1:** Option A — copy component as-is, strip broker-only actions.

---

## 10. Dependencies

Add to `apps/client/package.json` (match broker):

```json
{
  "dependencies": {
    "lucide-react": "^0.510.0",
    "recharts": "^3.8.1",
    "@radix-ui/react-tooltip": "^1.2.8"
  }
}
```

Optional: `@ko/utils` for `formatCurrency`, `calculateLTV`.

---

## 11. Backend / API

| Question | Answer |
|----------|--------|
| Need `/api/portal/calculators`? | **No** |
| Need broker changes? | **No** (unless extracting shared package) |
| Plan feature gate? | Optional — `calculators` is on all plans; can skip gate on client |

---

## 12. Acceptance criteria

- [ ] `/tools` renders inside client dashboard shell (sidebar nav active on Mortgage Tools)
- [ ] 8 calculator cards in 2×4 grid with correct colours/icons
- [ ] Selecting a card shows active calculator panel below (or replaces on mobile)
- [ ] All inputs update results live without submit
- [ ] Affordability: £72,000 × 4.5 = £324,000
- [ ] Stamp duty: £500,000 standard = £12,500
- [ ] LTV colour bands work (green / amber / red)
- [ ] Disclaimer footer visible
- [ ] No "Add to case note" or broker-only actions
- [ ] Works offline (no API required)
- [ ] Optional: case pre-fill when portal case API available

---

## 13. Broker references

| File | Use |
|------|-----|
| `apps/web/components/marketing/demo-calculator/MortgageCalculators.tsx` | Full UI + inline formulas |
| `apps/web/public/live-demo-prototype-v2a.html` | `.calc-grid`, `.calc-card` styles (lines ~1031–1036, 2449–2463) |
| `apps/web/components/marketing/live-demo-page.tsx` | Embeds calculators on `calculator` tab |
| `Doc/KO_Modular_PRD_Set_v2.docx.md` | PRD-11 formulas & acceptance tests |
| `packages/utils/src/index.ts` | `calculateLTV`, `formatCurrency` |
| `apps/web/lib/calculators/formulas.ts` | Target home for extracted formulas (currently stub) |

---

## 14. Phase plan

| Phase | Deliverable |
|-------|-------------|
| **Phase 1** | Copy `MortgageCalculators`, wire to `/tools`, card grid layout, disclaimer |
| **Phase 2** | Extract `formulas.ts` + unit tests; share package with broker |
| **Phase 3** | Pre-fill from portal case; "Copy result" button; link to message adviser |

---

*KO Client Portal · Mortgage Tools spec · Aligns with PRD-11 & live demo `MortgageCalculators.tsx`*
