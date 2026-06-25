# KO Client Portal — Fact-Find Modals, Upload & Error States

> **Source of truth:** `apps/web/public/live-demo-prototype-v2a.html` — Fact Find Wizard IIFE (`FF_ERROR_STATES`, `ffUploadModalHTML`, `ffStateOverlayHTML`, `ffCompHTML`, lines ~4791–5850)  
> **Companion:** [KO-Client-FactFind-Design.md](./KO-Client-FactFind-Design.md) (wizard shell + questions)  
> **Invite modal:** Client onboarding mockup (overlays dimmed fact-find on first visit)

Use this when building overlays, modals, and status UI in the **KO-Client** repo.

---

## 1. Overlay stack (z-index)

Render order bottom → top:

| Layer | z-index | Component |
|-------|---------|-----------|
| Dashboard + fact-find page | — | `/application` wizard (inline, not full-screen) |
| Dimmed backdrop | `500` | Invite welcome / modal scrim `rgba(13,31,26,.35–.45)` |
| Upload modal | `584` | `ff-upload-modal-wrap` |
| Missing-fields modal | `585` | `ff-missing-modal-wrap` |
| Auto-fill float pill | `586` | Left-edge `ff-upload-float` |
| Floating alerts | `590` | Amber/red processing pills |
| State toasts | `590` | Corner notification cards |
| Progress bar | `550` | Fixed top 3px strip |

**Client portal note:** Fact-find is **embedded** in `/application` (sidebar visible). Modals still use `position: fixed; inset: 0` over the main content area — not the full broker `ff-overlay` fullscreen shell.

---

## 2. Modal & state catalogue

| ID | UI pattern | Client portal | Broker live demo |
|----|------------|---------------|------------------|
| `invite-welcome` | Centre modal | **Yes — P0** | N/A |
| `invite-otp` | Centre modal / inline step | **Yes — P0** | N/A |
| `upload-documents` | Centre modal | **Yes — P1** | Yes |
| `upload-float` | Left floating CTA | Optional P2 | Yes |
| `missing-fields` | Centre modal | **Yes — P1** | Yes |
| `field-validation` | Inline under input | **Yes — P0** | Yes |
| `state-banner` | Inline amber banner on card | **Yes — P1** (simplified) | Yes |
| `save-offline` | Top-bar pill | **Yes — P1** | Yes |
| `processing-stalled` | Floating amber alert | Phase 2 (auto-fill) | Yes |
| `processing-paused` | Floating red alert | Phase 2 | Yes |
| `completion` | Centre success screen | **Yes — P0** (client copy) | Yes |
| `report-failed` | Bottom-left toast | **No** (broker) | Yes |
| `notification-failed` | Top-right toast | **No** (broker) | Yes |

---

## 3. Invite welcome modal (first visit)

Shown **before** OTP, over a **dimmed** fact-find wizard (sidebar + step nav visible behind scrim).

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░   ┌─────────────────────────────┐   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  [illustration + confetti]  │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │                             │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  Welcome to KO Brokers      │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │                             │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  Hi {firstName}, you have   │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  been invited by {adviser}  │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  to complete a fact find    │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  for case {caseRef}.        │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  Before you begin, an OTP   │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  will be sent to {email}.   │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │                             │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   │  [ 📧  Send Verification ]  │   ░░░░░░░░░░░░░ │
│ ░░░░░░░   └─────────────────────────────┘   ░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────────────────────────┘
```

### Spec

| Property | Value |
|----------|-------|
| Scrim | `background: rgba(13, 31, 26, 0.45)` |
| Modal width | `max-width: 480px` (100% − `40px` padding on mobile) |
| Modal bg | `#FFFFFF` |
| Border radius | `16px` |
| Shadow | `0 24px 60px rgba(24, 24, 27, 0.2)` |
| Title | Syne, `22–24px` bold, `#18181B` |
| Body | DM Sans, `14px`, `#52525B`, line-height 1.55 |
| CTA | Full width, `bg #0F6E56`, white text, `border-radius: 12px`, `height: 48px` |
| CTA label | **Send Verification** + mail icon |
| Illustration | Celebratory character asset (top of modal) |

### Behaviour

1. Show on `/invite?token=` or first `/application` visit if unverified.
2. **Send Verification** → `POST /api/portal/invite/send-otp`.
3. Transition to OTP entry (same modal step 2, or `/verify` route).
4. No close button on step 1 (invite-only entry). ESC disabled.

### Component

`components/auth/invite-welcome-modal.tsx`

---

## 4. OTP verification step

### Layout (step 2 of invite flow)

| Element | Spec |
|---------|------|
| Title | `Enter verification code` |
| Subtitle | `We sent a 6-digit code to {emailMasked}` |
| Input | 6 single-digit boxes OR one `input` with `maxLength={6}`, centred |
| CTA | **Verify & continue** (green, full width) |
| Secondary | **Resend code** (text link, disabled 60s countdown) |
| Error | Red inline: `Invalid or expired code. Try again.` |

### API

- `POST /api/portal/invite/verify-otp` `{ token, code }`
- On success: dismiss modal → `/overview` or continue fact-find on `/application`

---

## 5. Upload supporting documents modal

**Trigger:** User taps left float **“Auto-fill from documents”** OR optional prompt on Personal section entry.

### Default state

```
┌──────────────────────────────────────────────┐
│ [↑] Upload supporting documents          ✕  │
│     Got payslips, bank statements or ID      │
│     to hand? Upload them now to help         │
│     auto-fill this fact-find.                │
├──────────────────────────────────────────────┤
│ DOCUMENT RELATES TO                          │
│ [ Personal details              ▼ ]          │
│                                              │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│   [↑]  Drag and drop files here            │
│        PDF, PNG, or JPEG — up to 20 MB     │
│        [ Browse files ]                    │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                              │
│ No documents uploaded yet    [ Skip for now ]│
└──────────────────────────────────────────────┘
```

### CSS classes (from live demo)

| Element | Classes / values |
|---------|------------------|
| Wrap | `ff-upload-modal-wrap` — scrim `rgba(13,31,26,.35)`, centred flex |
| Modal | `ff-upload-modal` — `max-width: 480px`, `border-radius: 16px` |
| Header icon | `40×40` circle, `bg #E1F5EE`, icon `#0F6E56` |
| Title | Syne `16px` bold |
| Subtitle | `13px` `#71717A` |
| Close | `ff-close-btn` `32×32`, `✕` |
| Section label | `11px` uppercase `#71717A`, letter-spacing `.06em` |
| Select | `height: 40px`, `border-radius: 10px`, focus ring teal |
| Dropzone | `2px dashed #D4D4D8`, `bg #FAFAFA`, hover `#F7FBF9` / border `#99DCC5` |
| Browse btn | `ff-upload-browse` — green `#0F6E56` |
| Skip | `ff-upload-skip` — green pill, right-aligned |

### Document type select options

1. Personal details  
2. Employment  
3. Income  
4. Financial commitments  
5. Property details  
6. Adverse credit  
7. Goals & preferences  
8. Vulnerability assessment  
9. Other / general  

### File rules

| Rule | Value |
|------|-------|
| Allowed types | `.pdf`, `.png`, `.jpg`, `.jpeg` |
| Max size | **20 MB** |
| Drag & drop | Yes |
| Hidden input | `#ff-upload-file-input` |

### Upload error states (inside dropzone)

#### Too large (`uploadError: 'too-large'`)

| Property | Value |
|----------|-------|
| Dropzone | `ff-upload-dropzone--error` — border `#FCA5A5`, bg `#FFF1F2` |
| Icon | Red warning triangle in `#FEE2E2` circle |
| Title | **File exceeds 20 MB limit** (`#B91C1C`) |
| Description | Please compress the file or upload a PDF, PNG, or JPEG instead. |
| CTA | Red **Choose a different file** (`ff-upload-cta` `#DC2626`) |

#### Unsupported type (`uploadError: 'unsupported'`)

| Property | Value |
|----------|-------|
| Title | **Unsupported file type** |
| Description | We can't read .pages, .heic, or raw image formats. Please upload a PDF, PNG, or JPEG. |
| CTA | Red **Choose a different file** |

#### AI processing stalled (`ai-processing-stalled`)

| Property | Value |
|----------|-------|
| Dropzone | `ff-upload-dropzone--amber` |
| Icon | Amber spinner (`ff-mini-spinner`) |
| Title | **AI processing stalled** (`#B45309`) |
| Description | We're still trying to read your upload. You can continue manually and retry auto-fill later. |
| CTA | None (manual entry) |

### Post-upload flow (broker demo)

1. Valid file selected → close modal → start auto-fill simulation  
2. Client Phase 1: upload to `POST /api/portal/documents` + optional AI extract (Phase 2)

### Component files

```
components/fact-find/modals/upload-documents-modal.tsx
components/fact-find/upload-dropzone.tsx
hooks/use-fact-find-upload.ts
```

---

## 6. Auto-fill float (left edge)

Fixed pill on left side of wizard — opens upload modal.

| Property | Value |
|----------|-------|
| Position | `left: 16px`, `top: 50%`, `transform: translateY(-50%)` |
| z-index | `586` |
| Style | `border: 1px solid #99DCC5`, `bg #EDFFFA`, shadow green tint |
| Icon | `30×30` circle `#DDF4EB` |
| Title | **Auto-fill from documents** `12px` bold `#0F6E56` |
| Subtitle | Upload a file to prefill key fact-find fields. `11px` `#166534` |

**Client Phase 1:** Hide float until document upload API exists, OR show with upload-only (no AI).

---

## 7. Missing required fields modal

**Trigger:** User taps **Submit fact-find** on last card with incomplete required fields.

```
┌────────────────────────────────────────────────┐
│ Required fields missing                    ✕  │
│ 4 fields must be completed before this         │
│ fact-find can be submitted.                    │
├────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐  │
│ │ Personal: Date of birth              Fix →│  │
│ │ Required for identity verification        │  │
│ └──────────────────────────────────────────┘  │
│ ┌ ... more items ...                         ┐  │
├────────────────────────────────────────────────┤
│ Complete all fields to enable submission       │
│                          [ Review later ]      │
└────────────────────────────────────────────────┘
```

### Spec

| Element | Value |
|---------|-------|
| Wrap | `ff-missing-modal-wrap` — scrim `rgba(13,31,26,.45)` |
| Modal | `max-width: 620px`, `border-radius: 18px` |
| Title | Syne `25px` bold |
| List item | `bg #FFFBEF`, `border #FDE68A`, `border-radius: 14px` |
| Item title | `#92400E` bold `14px` |
| Item reason | `#A16207` `12px` |
| Fix link | **Fix field →** `#0F6E56` bold |
| Footer CTA | **Review later** grey pill `ff-review-later` |

### Behaviour

- **Fix field →** closes modal, navigates wizard to that question index
- **Review later** / **✕** dismisses modal; user stays on current card
- **✕** top-right same as `ff-close-btn`

### Client copy

Replace "Client 1" with "Your" / field labels from question registry.

---

## 8. Inline validation & banners

### Field-level error (`ff-field-error`)

Shown below invalid input after Continue or blur.

| Property | Value |
|----------|-------|
| Text | `12px` bold `#DC2626` |
| Input wrap | `ff-box-wrap.ff-invalid` — red border + shadow |
| Example | Please use letters only (no numbers) in this field. |
| Example | Please enter a valid value — must be a positive number. |

Inline row variant (`ff-inline-error`):

```html
<div class="ff-inline-error">
  [icon] Please enter a valid value — must be a positive number.
</div>
```

`margin-left: 26px` to align with question inputs.

### Open Banking / auto-fill failure banner (`ff-state-banner`)

Amber inline banner **above** question title on card:

| Property | Value |
|----------|-------|
| Background | `#FFF8E8` |
| Border | `#F5D38E` |
| Text | `#B45309` |
| Title | Syne `16px` bold `#92400E` |

**Copy (client):**

> **Document auto-fill unavailable**  
> We couldn't read your upload right now. You can continue manually — your progress is unaffected.

**Broker copy (reference):** Open Banking connection unavailable.

---

## 9. Save status (top bar)

Right side of fact-find top bar, beside `3 / 22` counter.

| State | Display | Colour |
|-------|---------|--------|
| Idle | (empty) | — |
| Saving | `Saving…` | `#f59e0b` amber |
| Saved | `Saved` | `#0F6E56` green (clears after 2.5s) |
| Offline | Pill: `Offline — saved locally` | `bg #FFFBEB`, border `#FCD34D`, text `#B45309` |

Offline pill includes warning icon SVG (`ff-offline-pill`).

### Logic

```typescript
// 2s debounce on field change
onChange → clearTimers → show 'Saving…'
→ PUT /api/portal/cases/:id/fact-find
  → success: 'Saved' → clear after 2500ms
  → network fail: switch to offline pill + sessionStorage backup
```

---

## 10. Floating processing alerts

Fixed pills during auto-fill simulation (Phase 2).

### Processing stalled (amber)

| Property | Value |
|----------|-------|
| Class | `ff-floating-alert ff-floating-alert--amber` |
| Background | `#EF9F27` |
| Content | Spinner + **Processing stalled** |
| Animation | None |

### AI processing paused (red)

| Property | Value |
|----------|-------|
| Class | `ff-floating-alert ff-floating-alert--red` |
| Background | `#DC2626` |
| Content | Icon + **AI processing paused. Click to retry.** |
| Animation | `ff-alert-beep` pulse 1.1s |

---

## 11. Broker-only toasts (omit on client)

### Report generation failed

- Position: bottom-left `ff-state-toast--report`
- Red tint border `#FECACA`, bg `#FFF7F7`
- Actions: Download text summary | Retry

### Email notification failed

- Position: top-right `ff-state-toast--notif`
- Amber tint; **Retry email** button

**Client portal:** Do not implement. Client completion uses simpler success screen only.

---

## 12. Completion screen (submit success)

**Trigger:** Last question validated → `markComplete: true` → API success.

### Broker reference copy

> Fact-find submitted — case can advance to **RESEARCH**

### Client portal copy

```
        [ green check in circle ]

        Fact-find submitted

        Thanks, {firstName}. Your adviser will review your
        answers and be in touch if anything else is needed.

        ┌─────────────────────────────┐
        │ Completed at    18 Jun 2026 │
        │ Case reference  KOF-2025-0042│
        │ Status          With your adviser │
        └─────────────────────────────┘

        [ Return to overview ]
```

### Spec

| Element | Value |
|---------|-------|
| Icon circle | `80×80`, `bg rgba(15,110,86,.1)`, check `#0F6E56` |
| Title | `24px` bold |
| Details card | `bg #f4f4f5`, `border-radius: 12px` |
| Primary CTA | **Return to overview** → `/overview` (`ff-comp-reset` style) |

**Omit on client:** "Start new fact-find", compliance stage jargon, "advance to RESEARCH".

---

## 13. Error state enum (for dev / QA)

Port `FF_ERROR_STATES` from live demo for toggling in Storybook or `?ffErrorState=` query param:

```typescript
export const FactFindErrorState = {
  FILE_TOO_LARGE: 'file-too-large',
  UNSUPPORTED_FILE_TYPE: 'unsupported-file-type',
  AI_PROCESSING_STALLED: 'ai-processing-stalled',
  AI_PROCESSING_PAUSED: 'ai-processing-paused',
  AUTO_FILL_API_FAILURE: 'auto-fill-api-failure',
  FIELD_VALIDATION_ERROR: 'field-validation-error',
  AUTO_SAVE_OFFLINE: 'auto-save-offline',
  MISSING_FIELDS: 'missing-fields',
  // Broker only:
  REPORT_GENERATION_FAILED: 'report-generation-failed',
  NOTIFICATION_FAILED: 'notification-failed',
} as const;
```

Demo URL (broker prototype): `?ffErrorState=missing-fields`

---

## 14. Component architecture (KO-Client)

```
components/fact-find/
├── modals/
│   ├── invite-welcome-modal.tsx       # P0 — onboarding
│   ├── otp-verification-modal.tsx     # P0 — or step 2 of invite
│   ├── upload-documents-modal.tsx     # P1
│   └── missing-fields-modal.tsx       # P1
├── overlays/
│   ├── fact-find-scrim.tsx            # Shared backdrop
│   ├── auto-fill-float.tsx            # P2
│   ├── processing-alert.tsx           # P2
│   └── completion-screen.tsx          # P0
├── feedback/
│   ├── save-status.tsx                # Top bar Saving/Saved/Offline
│   ├── state-banner.tsx               # Amber inline banner
│   ├── field-error.tsx                # Inline validation
│   └── upload-dropzone.tsx            # Reusable dropzone states
└── fact-find-wizard.tsx               # Orchestrates modal visibility
```

### State machine (simplified)

```typescript
type FactFindUiState =
  | { screen: 'invite-welcome' }
  | { screen: 'invite-otp' }
  | { screen: 'wizard' }
  | { screen: 'complete' };

type WizardOverlay =
  | null
  | 'upload'
  | 'missing-fields';

type WizardAlert =
  | null
  | 'auto-fill-failed'
  | 'processing-stalled'
  | 'processing-paused';
```

---

## 15. API mapping

| UI | Endpoint |
|----|----------|
| Send Verification | `POST /api/portal/invite/send-otp` |
| Verify OTP | `POST /api/portal/invite/verify-otp` |
| Auto-save | `PUT /api/portal/cases/:id/fact-find` |
| Submit complete | `PUT` with `markComplete: true` |
| Upload document | `POST /api/portal/documents` (multipart) |
| Offline fallback | `sessionStorage` key `ko-ff-draft-{caseId}` |

---

## 16. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Modal focus trap | Focus first focusable on open; restore on close |
| `role="dialog"` + `aria-modal="true"` | All centre modals |
| `aria-labelledby` | Point to modal title id |
| ESC | Close upload + missing-fields only (not invite step 1) |
| Live regions | `aria-live="polite"` on save status + inline errors |
| File input | Associated `<label>` for browse button |

---

## 17. Client vs broker summary

| Feature | Client | Broker |
|---------|--------|--------|
| Invite welcome + OTP | Yes | No |
| Upload modal | Yes (link to portal documents) | Yes |
| Auto-fill float + AI states | Phase 2 | Yes (demo simulation) |
| Missing fields modal | Yes | Yes |
| Offline save pill | Yes | Yes |
| Open Banking banner | Rephrase for uploads | Original copy |
| Report/notification toasts | No | Yes |
| Completion → overview | Yes | Close wizard / case detail |
| Full-screen `ff-overlay` | No (inline wizard) | Yes |

---

## 18. Acceptance criteria

- [ ] Invite welcome modal matches mockup; dynamic name/adviser/case/email
- [ ] OTP step with resend cooldown and error state
- [ ] Upload modal: default, too-large, unsupported, stalled dropzone variants
- [ ] Skip for now closes upload without blocking wizard
- [ ] Missing-fields modal lists gaps with Fix field → navigation
- [ ] Inline field errors on invalid Continue
- [ ] Save status cycles Saving → Saved; offline pill on network failure
- [ ] Completion screen with Return to overview (no broker jargon)
- [ ] Broker-only toasts not rendered on client
- [ ] All modals use correct z-index stacking
- [ ] Scrim dims fact-find behind invite modal (sidebar stays visible)

---

## 19. Source references

| File | Content |
|------|---------|
| `live-demo-prototype-v2a.html` ~1056–1297 | All `ff-*` CSS |
| `live-demo-prototype-v2a.html` ~4813–5500 | `FF_ERROR_STATES`, modal HTML generators |
| `live-demo-prototype-v2a.html` ~5827–5848 | Completion screen |
| `Doc/KO-Client-FactFind-Design.md` | Wizard shell |
| `Doc/KO-Portal-API-Backend-Ticket.md` | Invite OTP + documents API |
| `apps/web/components/dashboard/api-error-state.tsx` | Error pattern reference |

---

*KO Client Portal · Fact-find modals & states · Live demo v2a*
