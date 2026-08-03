# Archived: old React dashboard

The approved dashboard is `/dashboard` → `LiveDemoPage` + `live-demo-prototype-v2a.html`.

Legacy React section routes (`/dashboard/clients`, `/cases`, `/messages`, etc.) and the
sidebar shell (`DashboardNav` / `DashboardShell`) are disabled at runtime:

- `next.config.ts` redirects those URLs to `/dashboard` (settings → `?tab=settings`)
- Route `page.tsx` files under `app/(dashboard)/dashboard/*` are redirect stubs only
- `DashboardNav` / shell / old-only helpers are no-op stubs so they cannot remount UI

Snapshots of the previous implementations (from git HEAD at archive time) live in:

- `pages/` — former route page sources
- `components/` — former `dashboard-nav`, `add-client-modal`, `api-error-state`, `plan-gate`

Do not remount the old sidebar or section pages — it would split the product UI.
Live settings/billing panels (`integrations-settings-panel`, etc.) stay active inside LiveDemoPage.
