# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow adhering to the 15 Modular PRDs (PRD-00 through PRD-14). 
Context files define what to build, how to build it, and the current state of progress. Always implement against these specs — do not infer or invent behavior from scratch. Follow the sequential order of the PRDs; foundational PRDs (00-05) must be complete before feature PRDs (06+).

## Scoping Rules

- Work on one PRD or one defined feature unit at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries (e.g., Landing Page vs CRM functionality) in a single implementation step.

## When to Split Work

Split an implementation step if it combines:

- Different PRD sections (e.g., building the Compliance Engine alongside AI Report Generation).
- Backend structural changes with complex UI state interactions.
- Behavior not clearly defined in the context files or PRDs.

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the PRD or context files.
- If a requirement is ambiguous, resolve it in the relevant context file before implementing.
- If a requirement is missing, add it as an open question in `progress-tracker.md` before continuing.

## Protected Files

Do not modify the following unless explicitly instructed:

- `packages/db/prisma/schema.prisma` (once established, except for explicit planned schema migrations).
- `components/ui/*` — generated `shadcn/ui` library components.
- Existing database migrations in `/packages/db/prisma/migrations/`.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries (`architecture.md`)
- Storage model decisions (`architecture.md`)
- Code conventions or standards (`code-standards.md`)
- Feature scope (`project-overview.md`)
- Progression of PRDs (`progress-tracker.md`)

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope.
2. No invariant defined in `architecture.md` (e.g. AuditLog immutability, Multi-tenant isolation) was violated.
3. `progress-tracker.md` reflects the completed work.
4. CI checks pass: `tsc --noEmit` and `eslint` complete with zero errors/warnings.
5. Unit tests (via `vitest`) run successfully.
6. A Pull Request is created and reviewed by the Head of D&E before merging to `main`.
