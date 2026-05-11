# KO Broker Platform - AI Agent Guide

You are an expert AI software engineer assisting in the development of the **KO Broker Platform**, a smarter, zero-cost MVP broker platform built for UK mortgage brokerages by Luxcity Technology for KO Realtors (KO Broker). 

Your goal is to build out this platform sequentially, adhering strictly to the architecture, design tokens, and invariants defined in the context files.

---

## 1. Project Overview & Workflow

- **Spec-Driven**: The platform is built incrementally using a 15-module PRD sequence (PRD-00 through PRD-14). 
- **Scope Control**: Work on one PRD or defined feature unit at a time. Do not combine unrelated system boundaries (e.g., Landing Page vs CRM functionality) in a single step.
- **Reference**: Always check the `context/` folder files for up-to-date specifications (`project-overview.md`, `architecture.md`, `ui-context.md`, `code-standards.md`, `ai-workflow-rules.md`, `progress-tracker.md`).
- **Tracking**: Check `context/progress-tracker.md` to see the current sprint and active goals before writing code. Update it when a phase completes.

## 2. Tech Stack & Architecture

- **Framework**: Next.js 14 (App Router) + TypeScript. Default to Server Components.
- **UI**: Tailwind CSS + `shadcn/ui` primitives.
- **Auth & Multi-Tenancy**: Clerk. Data is strictly isolated by `orgId` injected via headers.
- **Database**: PostgreSQL + Prisma, hosted on Supabase. Always use the Prisma client singleton (`lib/db/index.ts`).
- **File Storage**: Cloudflare R2 (Do not store large files or blobs in Postgres).
- **AI Inference**: Azure AI Foundry (GPT-4o/mini) for suitability reports.
- **Communications**: Resend (Email) + Twilio (SMS).

### System Boundaries
- `apps/web/app/(marketing)` — Public landing pages.
- `apps/web/app/(dashboard)` — Protected dashboard applications.
- `apps/web/components/ui` — Generated `shadcn/ui` primitives (DO NOT MODIFY).
- `packages/db` — Shared Prisma schema.
- `packages/types` — Shared TypeScript types and Zod schemas.

## 3. Core Architectural Invariants (CRITICAL)

1. **Immutable Audit Trail**: `AuditLog` records are strictly **INSERT-ONLY**. No `UPDATE` or `DELETE` operations are ever permitted at either the ORM level or the DB RLS level. Call `logAuditEvent()` in `lib/compliance/audit.ts` for all mutation handlers.
2. **Strict Multi-Tenancy**: An authenticated user from Org A must absolutely never be able to retrieve or mutate data belonging to Org B.
3. **API Handler Factory**: All route handlers must use the `createHandler(config)` factory from `lib/api/handler.ts`. Zero raw `try/catch` blocks in API route files.
4. **Feature Branching**: All work must happen on feature branches. No direct pushes to `main`.

## 4. Coding Standards

- **Vibe Code First, Polish Later**: Bias towards action and prototype-quality code to validate features quickly, but ensure it passes strict CI checks.
- **Strict TypeScript**: `tsc --noEmit` must pass without errors. Avoid `any`.
- **Validation**: Enforce Zod validation for all `POST`/`PATCH`/`PUT` requests. Zod failures automatically return a 422 `VALIDATION_ERROR`.
- **Responses**: Predictable `{ success, data, meta }` or `{ success, error }` envelopes.

## 5. UI & Styling Guidelines

- **No Hardcoded Hex Values**: Use the Tailwind custom property tokens defined in `tailwind.config.ts`.
- **Brand Colors**: 
  - Primary: `brand.teal-700` (H1, CTA, Nav Logo)
  - Accent: `brand.teal-500` (Hover states)
  - Highlight: `brand.teal-400`
  - Backgrounds: `surface` for dashboard, `brand.teal-50` for faded cards.
- **Stage Colorways**: Apply specific stage background/text colors for Enquiry (Blue), Fact-Find (Orange), Research (Green), DIP (Purple), and Offer (Rose).
- **Typography**: Syne (Headings), DM Sans (Body), Courier New (Code).
- **Layout Patterns**: 
  - **Pipeline**: 5-column drag-and-drop Kanban (`@dnd-kit/core`).
  - **Case Details**: Full-screen overlay with a top header and 5 sub-tabs (Overview, Documents, Compliance, Messages, AI Report).
  - **Forms**: Slide-overs and Modals with inline Zod validation (`react-hook-form`).

## 6. Definition of Done

Before considering a task complete:
1. The unit works end-to-end within its defined scope.
2. No invariant (`AuditLog` immutability, `orgId` isolation) is violated.
3. `tsc --noEmit` and `eslint` complete with zero errors/warnings.
4. Unit tests (`vitest`) run successfully.
5. `progress-tracker.md` reflects the completed work.
