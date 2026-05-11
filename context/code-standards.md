# Code Standards

## General

- **Vibe Code First, Polish Later**: Move quickly with prototype-quality code to validate features, but refactor before final delivery.
- **Single-Purpose Modules**: Keep components and utilities small and focused.
- **Fix Root Causes**: Do not layer workarounds; address underlying architectural issues.

## TypeScript

- **Strict Mode**: Required throughout the entire monorepo (`tsc --noEmit` must pass without errors).
- **Explicit Typings**: Avoid `any`. Use explicit interfaces or narrowly scoped types from `/packages/types`.
- **Validation**: Validate all unknown external input (e.g., API request bodies) using Zod schemas at the system boundaries before trusting it.

## Next.js (App Router)

- **Server vs Client**: Default to Server Components. Add `"use client"` only when browser interactivity or hooks (like `useState`, `useEffect`) require it.
- **Data Fetching**: Use TanStack Query on the frontend for data fetching and cache management.
- **API Routing**: Follow the App Router conventions (`route.ts` exporting GET/POST/PATCH/DELETE).

## Styling

- **Tokens Only**: Use CSS custom property tokens defined in `tailwind.config.ts` (e.g., `brand.teal-700`). Do not use hardcoded hex values.
- **Component Library**: Build custom components on top of `shadcn/ui` primitives. Never replace or break the base primitives.
- **Responsiveness**: Ensure interfaces render correctly across 375px (mobile) and 1280px+ (desktop) viewports.

## API Routes

- **Consistent Routing**: All routes must use the `createHandler(config)` factory from `lib/api/handler.ts`.
- **Validation**: Enforce Zod validation for all `POST`/`PATCH`/`PUT` requests. Zod failures automatically return a 422 `VALIDATION_ERROR`.
- **Auth & Ownership**: Enforce `requireAuth` and `requiredRole` checks before any mutation.
- **Predictable Responses**: 
  - Success: `{ "success": true, "data": <T>, "meta": { "total": number, "page": number, "perPage": number } }`
  - Error: `{ "success": false, "error": { "code": string, "message": string, "fields"?: Record<string,string> } }`
- **Pagination**: Support `page` and `perPage` query params for all list endpoints.

## Data and Storage

- **Database Access**: Always use the Prisma client singleton (`lib/db/index.ts`) to avoid connection pool exhaustion.
- **Schema Flexibility**: Use named JSON fields for complex, evolving forms like the Fact-Find, rather than flattening everything into columns.
- **Audit Logging**: Call `logAuditEvent()` in `lib/compliance/audit.ts` for all mutation handlers to compute deep-diff snapshots.

## File Organization

- `apps/web/app/(marketing)/` — Public landing pages.
- `apps/web/app/(dashboard)/` — Protected dashboard pages.
- `apps/web/components/ui/` — Base `shadcn/ui` primitives.
- `apps/web/lib/` — Shared utilities (auth, db, ai, calculators).
- `packages/db/` — Prisma schema and migrations.
- `packages/types/` — Shared TypeScript types and Zod schemas.
