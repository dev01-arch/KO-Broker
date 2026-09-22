# PRD-16 Phase 3 — Test Guide

## What Was Built

| Item | Location | Description |
| :---- | :---- | :---- |
| `notes-data.ts` | `apps/web/lib/api/notes-data.ts` | `listNotesForCase`, `createNoteForCase`, `serializeCaseNote`. INSERT-ONLY — no update/delete. |
| `GET /api/cases/:id/notes` | `apps/web/app/api/cases/[id]/notes/route.ts` | Returns all notes for a case, oldest first, with author. |
| `POST /api/cases/:id/notes` | same | Appends a new note. No update/delete endpoints exist. |
| `getCaseForOrg` extended | `apps/web/lib/api/cases-data.ts` | Now includes `notes[]` with author in the case detail query. |
| `serializeCaseDetail` extended | `apps/web/lib/api/cases.ts` | Exposes `notes[]` and PRD-16 W1 product fields in GET /api/cases/:id. |
| `copy-to-notes` updated | `apps/web/app/api/intelligence/snapshots/[id]/copy-to-notes/route.ts` | Inserts `CaseNote { source: INTEL, tag: intel }` — no longer writes `Case.adviserNotes`. |
| `migrate-adviser-notes.ts` | `packages/db/prisma/migrate-adviser-notes.ts` | Backfill script — converts existing `Case.adviserNotes` strings to `CaseNote` rows. Idempotent. |

---

## Prerequisites

- Dev server running on port 3001 (`cd apps/web && pnpm dev`)
- Valid `__session` cookie from a logged-in Clerk session
- A valid `CASE_ID` from your org (get one from `GET /api/cases`)

```bash
SESSION="__session=PASTE_YOUR_COOKIE_HERE"
BASE="http://localhost:3001"
CASE_ID="paste-case-id-here"
```

---

## Test Group 1 — adviserNotes backfill (no server required)

### 1a. Verify the migration ran

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const total = await p.caseNote.count();
  const adviser = await p.caseNote.count({ where: { source: 'ADVISER' } });
  const intel = await p.caseNote.count({ where: { source: 'INTEL' } });
  const system = await p.caseNote.count({ where: { source: 'SYSTEM' } });
  console.log('Total CaseNote rows :', total);
  console.log('source=ADVISER      :', adviser, '(backfilled from adviserNotes)');
  console.log('source=INTEL        :', intel);
  console.log('source=SYSTEM       :', system);
  await p.\$disconnect();
})();
"
```

**Expected:** `adviser` count matches the 10 cases migrated (or more if you've added notes since). Total > 0.

---

### 1b. Verify Case.adviserNotes is still readable (not cleared)

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const withNotes = await p.case.count({
    where: { adviserNotes: { not: null } }
  });
  console.log('Cases still with adviserNotes (not cleared):', withNotes);
  await p.\$disconnect();
})();
"
```

**Expected:** Same count as before the migration (10). The column is NOT cleared.

---

### 1c. Verify migration is idempotent

Run it a second time:

```bash
cd packages/db && npx tsx prisma/migrate-adviser-notes.ts
```

**Expected:**
```
Found 10 case(s) with non-empty adviserNotes
✅ adviserNotes backfill complete
   Inserted : 0
   Skipped  : 10 (CaseNote already existed)
   Errors   : 0
```

Zero inserts on re-run — idempotency confirmed.

---

## Test Group 2 — GET/POST /api/cases/:id/notes (server required)

### 2a. GET notes for a case

```bash
curl -s "$BASE/api/cases/$CASE_ID/notes" \
  -H "Cookie: $SESSION" | jq '{success, count: (.data | length), first: .data[0]}'
```

**Expected:**
```json
{
  "success": true,
  "count": <number>,
  "first": {
    "id": "...",
    "caseId": "...",
    "body": "...",
    "source": "ADVISER",
    "createdAt": "..."
  }
}
```

If the case had `adviserNotes`, the first entry will be the backfilled note (`source: "ADVISER"`).

---

### 2b. POST a new adviser note

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/notes" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Client confirmed income docs will be sent by Friday.",
    "tag": "disclosure"
  }' | jq '{success, data: {id: .data.id, body: .data.body, tag: .data.tag, source: .data.source}}'
```

**Expected:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "body": "Client confirmed income docs will be sent by Friday.",
    "tag": "disclosure",
    "source": "ADVISER"
  }
}
```

HTTP 201.

---

### 2c. POST a note with no tag (tag is optional)

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/notes" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"body": "Follow-up call booked for Tuesday."}' \
  | jq '{success, tag: .data.tag}'
```

**Expected:** `success: true`, `tag: null` or `tag` absent.

---

### 2d. POST a note with empty body — should return 422

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/notes" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"body": ""}' | jq '{success, error}'
```

**Expected:** `success: false`, `error.code: "VALIDATION_ERROR"`, HTTP 422.

---

### 2e. Verify notes accumulate — GET returns all in order

```bash
curl -s "$BASE/api/cases/$CASE_ID/notes" \
  -H "Cookie: $SESSION" | jq '[.data[] | {body: .body, source: .source, createdAt: .createdAt}]'
```

**Expected:** Notes ordered oldest-first (`createdAt` ascending). The two notes added in 2b and 2c appear at the end.

---

### 2f. Confirm there is no DELETE or PATCH endpoint

```bash
NOTE_ID=$(curl -s "$BASE/api/cases/$CASE_ID/notes" -H "Cookie: $SESSION" | jq -r '.data[0].id')

curl -s -X DELETE "$BASE/api/cases/$CASE_ID/notes/$NOTE_ID" \
  -H "Cookie: $SESSION" | jq .

curl -s -X PATCH "$BASE/api/cases/$CASE_ID/notes/$NOTE_ID" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"body": "tampered"}' | jq .
```

**Expected:** Both return 404 (route does not exist). Notes cannot be mutated.

---

## Test Group 3 — GET /api/cases/:id includes notes[]

### 3a. Case detail response includes notes array

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{id: .data.id, noteCount: (.data.notes | length), firstNote: .data.notes[0]}'
```

**Expected:** `noteCount` > 0 (at least the backfilled note), `firstNote` has `id`, `body`, `source`, `createdAt`.

---

### 3b. notes[] are in chronological order in case detail

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '[.data.notes[] | .createdAt]'
```

**Expected:** ISO timestamps in ascending order (oldest first).

---

## Test Group 4 — Intelligence copy-to-notes writes CaseNote

This test requires a case with at least one `CaseIntelligenceSnapshot` linked to it (i.e., Intel was run on this case previously).

### 4a. Find a snapshot linked to a case

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const snap = await p.caseIntelligenceSnapshot.findFirst({
    where: { caseId: { not: null } },
    select: { id: true, caseId: true }
  });
  console.log('Snapshot:', JSON.stringify(snap));
  await p.\$disconnect();
})();
"
```

Copy the snapshot `id` as `SNAPSHOT_ID`.

### 4b. POST copy-to-notes

```bash
SNAPSHOT_ID="paste-snapshot-id-here"

curl -s -X POST "$BASE/api/intelligence/snapshots/$SNAPSHOT_ID/copy-to-notes" \
  -H "Cookie: $SESSION" | jq .
```

**Expected:** `{ "success": true, "data": { "caseId": "...", "snapshotId": "..." } }`

### 4c. Verify a CaseNote was created with source=INTEL

```bash
curl -s "$BASE/api/cases/$CASE_ID/notes" \
  -H "Cookie: $SESSION" | jq '[.data[] | select(.source == "INTEL")] | {count: length, last: .[-1]}'
```

**Expected:** At least one note with `source: "INTEL"`, `tag: "intel"`, body starting with `[Mortgage Intelligence ·`.

### 4d. Verify Case.adviserNotes was NOT updated

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const c = await p.case.findFirst({
    where: { id: 'PASTE_CASE_ID' },
    select: { adviserNotes: true }
  });
  console.log('adviserNotes (should be unchanged):', c?.adviserNotes);
  await p.\$disconnect();
})();
"
```

**Expected:** `adviserNotes` value is identical to what it was before the copy-to-notes call. The Intel content is now only in the CaseNote, not appended to the string field.

---

## Phase 3 Acceptance Checklist

| # | Test | Pass condition |
| :- | :---- | :---- |
| 1 | Backfill ran — CaseNote rows exist | `source=ADVISER` count > 0 |
| 2 | Case.adviserNotes not cleared | Count unchanged after migration |
| 3 | Migration is idempotent | Second run: `Inserted: 0, Skipped: N` |
| 4 | GET /api/cases/:id/notes returns notes | `success: true`, array in createdAt order |
| 5 | POST creates note with tag | HTTP 201, `source: "ADVISER"` |
| 6 | POST empty body returns 422 | `error.code: "VALIDATION_ERROR"` |
| 7 | No DELETE/PATCH endpoint | Both return 404 |
| 8 | GET /api/cases/:id includes notes[] | `data.notes` array present, oldest first |
| 9 | copy-to-notes inserts CaseNote | `source: "INTEL"`, `tag: "intel"` |
| 10 | copy-to-notes does NOT touch adviserNotes | String field unchanged after call |

---

## Key Design Decisions Recorded

**INSERT-ONLY discipline:** `CaseNote` has no update or delete routes. The API directory for `/api/cases/:id/notes` only exports `GET` and `POST`. Any future attempt to add a DELETE route should be rejected at PR review.

**adviserNotes kept readable:** `Case.adviserNotes` is not cleared. It stays readable for one release cycle. Future work (Phase 7 or later) can drop the column once all clients read from `notes[]`.

**copy-to-notes migration:** The Intel copy-to-notes route no longer appends to the `adviserNotes` string. Any adviser who had Intel notes in `adviserNotes` will see them in the thread (backfilled as `source: ADVISER`) and new Intel notes will appear as `source: INTEL`. The two sources are visually distinguishable in the UI by the `source` and `tag` fields.
