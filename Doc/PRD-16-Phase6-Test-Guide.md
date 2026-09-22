# PRD-16 Phase 6 — Test Guide

## What Was Built

| Item | Location | Description |
| :---- | :---- | :---- |
| `info-requests-data.ts` | `apps/web/lib/api/info-requests-data.ts` | `createInfoRequestForCase`, `listInfoRequestsForCase`, `fulfilInfoRequestsForDocument`, `fulfilInfoRequestsForChecklistItem`, `serializeInfoRequest`. |
| `GET /api/cases/:id/info-requests` | `apps/web/app/api/cases/[id]/info-requests/route.ts` | Returns all info requests for a case. |
| `POST /api/cases/:id/info-requests` | same | Creates a request, sends message via PRD-10 broadcast, returns HTTP 201 with `infoRequest` + `delivery`. |
| `POST /api/documents` extended | `apps/web/app/api/documents/route.ts` | Calls `fulfilInfoRequestsForDocument` fire-and-forget after document create when `caseId` is present. |
| `completeComplianceItemForOrg` extended | `apps/web/lib/api/compliance-overview-data.ts` | Calls `fulfilInfoRequestsForChecklistItem` fire-and-forget after checklist item completion. |
| `getCaseForOrg` extended | `apps/web/lib/api/cases-data.ts` | Includes `infoRequests` (OUTSTANDING only) in case detail query. |
| `serializeCaseDetail` extended | `apps/web/lib/api/cases.ts` | Exposes `infoRequests[]` in `GET /api/cases/:id` response. |

---

## Prerequisites

- Dev server running: `cd apps/web && pnpm dev` (port 3001)
- Valid `__session` cookie
- A case with a client who has an email address

```bash
SESSION="__session=PASTE_YOUR_COOKIE_HERE"
BASE="http://localhost:3001"

CASE_ID=$(curl -s "$BASE/api/cases" -H "Cookie: $SESSION" | jq -r '.data[0].id')
echo "CASE_ID: $CASE_ID"
```

---

## Test Group 1 — Create info request (server required)

### 1a. Request an INCOME document

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"documentType": "INCOME"}' \
  | jq '{success, infoRequest: {id: .data.infoRequest.id, status: .data.infoRequest.status, documentType: .data.infoRequest.documentType}, delivery: .data.delivery}'
```

**Expected:**
```json
{
  "success": true,
  "infoRequest": { "id": "...", "status": "OUTSTANDING", "documentType": "INCOME" },
  "delivery": { "inApp": "sent", "email": "scheduled", "sms": "skipped" }
}
```

HTTP 201. Save `infoRequest.id` as `REQUEST_ID`.

```bash
REQUEST_ID=$(curl -s -X POST "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" -H "Content-Type: application/json" \
  -d '{"documentType": "INCOME"}' | jq -r '.data.infoRequest.id')
echo "REQUEST_ID: $REQUEST_ID"
```

---

### 1b. Request with checklistItemId

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"checklistItemId": "id_document"}' \
  | jq '{status: .data.infoRequest.status, checklistItemId: .data.infoRequest.checklistItemId}'
```

**Expected:** `status: "OUTSTANDING"`, `checklistItemId: "id_document"`.

---

### 1c. Request with custom body override

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"documentType": "ID", "body": "Please send 2 forms of photo ID for verification."}' \
  | jq '{status: .data.infoRequest.status}'
```

---

### 1d. Request with neither documentType nor checklistItemId — should return 422

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"body": "Please send something"}' \
  | jq '{success, code: .error.code}'
```

**Expected:** `success: false`, `code: "VALIDATION_ERROR"`, HTTP 422.

---

### 1e. Verify a message was sent to the client

```bash
curl -s "$BASE/api/messages?caseId=$CASE_ID" \
  -H "Cookie: $SESSION" | jq '[.data[] | select(.sourceType == "COMPLIANCE")] | {count: length, last: .[-1] | {body: .body, sourceType: .sourceType}}'
```

**Expected:** At least one COMPLIANCE message, body containing the case reference number.

---

## Test Group 2 — List info requests (server required)

### 2a. GET all info requests for a case

```bash
curl -s "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" | jq '{count: (.data | length), statuses: [.data[].status]}'
```

**Expected:** All have `status: "OUTSTANDING"` (none fulfilled yet).

---

### 2b. Verify GET /api/cases/:id includes infoRequests[]

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '{id: .data.id, outstandingCount: (.data.infoRequests | length), first: .data.infoRequests[0]}'
```

**Expected:** `outstandingCount` matches the number created above. Each entry has `id`, `documentType`/`checklistItemId`, `status: "OUTSTANDING"`, `createdAt`.

---

## Test Group 3 — Auto-fulfil on document upload (server required)

### 3a. Upload a document with documentType = INCOME

First confirm the INCOME request is still OUTSTANDING:

```bash
curl -s "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" | jq '[.data[] | select(.documentType == "INCOME" and .status == "OUTSTANDING")]'
```

Now upload a document:

```bash
# Create a small test file
echo "payslip content" > /tmp/test-payslip.pdf

curl -s -X POST "$BASE/api/documents" \
  -H "Cookie: $SESSION" \
  -F "file=@/tmp/test-payslip.pdf;type=application/pdf" \
  -F "name=Payslip_March_2026.pdf" \
  -F "documentType=INCOME" \
  -F "caseId=$CASE_ID" \
  | jq '{success, id: .data.id, documentType: .data.documentType}'
```

**Expected:** `success: true`, `documentType: "INCOME"`, HTTP 201.

---

### 3b. Verify the INCOME info request is now FULFILLED

Give the async fulfil a moment to complete:

```bash
sleep 1

curl -s "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" | jq '[.data[] | {documentType, status, fulfilledDocumentId}]'
```

**Expected:** The INCOME request now has `status: "FULFILLED"` and `fulfilledDocumentId` set.

---

### 3c. Verify GET /api/cases/:id no longer shows the fulfilled request

```bash
curl -s "$BASE/api/cases/$CASE_ID" \
  -H "Cookie: $SESSION" | jq '.data.infoRequests | length'
```

**Expected:** Count is one fewer than before the upload (FULFILLED requests are excluded from `infoRequests[]` in the case detail).

---

### 3d. Verify audit event exists

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const logs = await p.auditLog.findMany({
    where: { entityId: 'PASTE_CASE_ID', action: 'INFO_REQUEST_FULFILLED' },
    select: { action: true, diff: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log(JSON.stringify(logs, null, 2));
  await p.\$disconnect();
})();
"
```

**Expected:** At least one `INFO_REQUEST_FULFILLED` audit event with the document id and type in the diff.

---

## Test Group 4 — Fulfil via compliance item completion (server required)

### 4a. Create an info request tied to a checklist item

```bash
curl -s -X POST "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"checklistItemId": "initial_disclosure"}' \
  | jq '{status: .data.infoRequest.status, checklistItemId: .data.infoRequest.checklistItemId}'
```

**Expected:** `status: "OUTSTANDING"`, `checklistItemId: "initial_disclosure"`.

---

### 4b. Complete the checklist item via the compliance endpoint

```bash
curl -s -X POST "$BASE/api/compliance/items" \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d "{\"caseId\": \"$CASE_ID\", \"itemId\": \"initial_disclosure\"}" \
  | jq '{success}'
```

**Expected:** `success: true`.

---

### 4c. Verify the info request is now FULFILLED

```bash
sleep 1

curl -s "$BASE/api/cases/$CASE_ID/info-requests" \
  -H "Cookie: $SESSION" | jq '[.data[] | select(.checklistItemId == "initial_disclosure")] | {count: length, status: .[0].status}'
```

**Expected:** `status: "FULFILLED"`.

---

## Test Group 5 — DB verification (no server required)

```bash
cd packages/db && npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
(async () => {
  const total = await p.clientInfoRequest.count();
  const outstanding = await p.clientInfoRequest.count({ where: { status: 'OUTSTANDING' } });
  const fulfilled = await p.clientInfoRequest.count({ where: { status: 'FULFILLED' } });
  console.log('Total info requests :', total);
  console.log('OUTSTANDING         :', outstanding);
  console.log('FULFILLED           :', fulfilled);
  await p.\$disconnect();
})();
"
```

**Expected:** Counts match the requests created and fulfilled in the tests above.

---

## Phase 6 Acceptance Checklist

| # | Test | Pass condition |
| :- | :---- | :---- |
| 1 | POST info request with documentType | HTTP 201, `status: "OUTSTANDING"`, message sent |
| 2 | POST info request with checklistItemId | HTTP 201, `checklistItemId` present |
| 3 | POST with neither documentType nor checklistItemId | HTTP 422, VALIDATION_ERROR |
| 4 | Message created and linked to case | COMPLIANCE message in case messages |
| 5 | GET /api/cases/:id/info-requests returns list | All OUTSTANDING entries |
| 6 | GET /api/cases/:id includes infoRequests[] | OUTSTANDING only, count correct |
| 7 | Upload matching documentType → auto-fulfils | `status: "FULFILLED"`, `fulfilledDocumentId` set |
| 8 | Fulfilled request excluded from case infoRequests[] | Count decreases after upload |
| 9 | Complete checklist item → fulfils matching request | `status: "FULFILLED"` |
| 10 | INFO_REQUEST_FULFILLED audit event exists | Audit log entry with document/checklist info |
| 11 | No DELETE or PATCH endpoint for info-requests | 404 on attempt |

---

## Design Notes

**Message body pre-fill:** The message body is automatically constructed from the `documentType` or `checklistItemId` and the case `referenceNumber`. The adviser can override it by passing `body` in the request. Portal clients get a hint to upload via the portal.

**Fire-and-forget fulfil:** Both auto-fulfil paths (document upload and checklist completion) are `void` — they do not block the primary HTTP response. The main operation (document create or compliance item create) completes first; fulfilment happens asynchronously but typically within milliseconds on the same DB.

**OUTSTANDING filter on case detail:** `GET /api/cases/:id` only includes `status: "OUTSTANDING"` requests in `data.infoRequests[]`. This gives the UI a clean outstanding badge count without fetching the full history. Use `GET /api/cases/:id/info-requests` to see all requests including FULFILLED ones.
