# Architecture Context

## Stack

| Layer     | Technology                  | Role   |
| --------- | --------------------------- | ------ |
| Framework | Next.js 14 (App Router) + TypeScript | Full-stack application and API routing. |
| UI        | Tailwind CSS + shadcn/ui    | Styling and base component library. |
| Auth      | Clerk                       | Authentication and Multi-Tenancy (orgs). |
| Database  | PostgreSQL + Prisma         | Relational database, hosted on Supabase. |
| File Storage | Cloudflare R2            | Document and generated PDF storage. |
| AI Inference | Azure AI Foundry         | Suitability report generation (GPT-4o/mini). |
| Communications | Resend + Twilio        | Email and SMS delivery. |

## System Boundaries

- `/apps/web/app/(marketing)` — Public-facing landing and marketing pages.
- `/apps/web/app/(dashboard)` — Protected application route group containing the main CRM and platform tools.
- `/apps/web/app/api` — Route handlers encapsulating all backend logic using a consistent `createHandler` factory.
- `/apps/web/components/ui` — Generated `shadcn/ui` primitive components.
- `/packages/db` — Prisma schema and generated database client (shared).
- `/packages/types` — Shared TypeScript types and Zod validation schemas.
- `/packages/utils` — Shared pure utility functions.

## Storage Model

- **PostgreSQL Database (Supabase)**: Stores all structured metadata, relationships, and application state (e.g., Organisations, Users, Clients, Cases, ComplianceRecords, AuditLogs).
- **Cloudflare R2**: Object storage for large binary files, user-uploaded documents, and generated Suitability Report PDFs. (Do not store large files or blobs in Postgres).

## Auth and Access Model

- **Authentication**: Every user signs in via Clerk (Email+Password or Google OAuth).
- **Multi-Tenancy**: Data is strictly isolated by `orgId` injected via headers from the Clerk session.
- **Roles**: Access is governed by RBAC (ADMIN, ADVISER, COMPLIANCE, VIEWER) enforced at the API layer via `requireRole()`.

## Invariants

1. **Immutable Audit Trail**: `AuditLog` records are strictly INSERT-ONLY. No `UPDATE` or `DELETE` operations are permitted at either the ORM level or the DB RLS level.
2. **Strict Multi-Tenancy**: An authenticated user from Org A must absolutely never be able to retrieve or mutate data belonging to Org B.
3. **API Handler Factory**: All route handlers must use the `createHandler(config)` factory; zero raw try/catch blocks in API route files.
4. **Feature Branching**: All work must happen on feature branches with PR reviews. No direct pushes to `main`.
