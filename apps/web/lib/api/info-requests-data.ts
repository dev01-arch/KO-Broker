/**
 * ClientInfoRequest data layer — PRD-16 W5
 *
 * Tracks "request from client" actions. An info request:
 *  - sends a message to the client via the existing PRD-10 broadcast path
 *  - stays OUTSTANDING until a matching document is uploaded or the
 *    adviser confirms the checklist item
 *  - appears as a count badge on the case compliance panel
 *
 * No UPDATE or DELETE endpoints — status transitions only via
 * fulfilInfoRequestsForDocument and fulfilInfoRequestsForChecklistItem.
 */

import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { broadcastMessageForOrg } from '@/lib/api/messages-data';
import type { CreateInfoRequestInput } from '@ko/types';

// ── Serialiser ────────────────────────────────────────────────────────────────

export function serializeInfoRequest(req: {
  id: string;
  orgId: string;
  caseId: string;
  clientId: string;
  checklistItemId: string | null;
  documentType: string | null;
  messageId: string | null;
  status: string;
  fulfilledDocumentId: string | null;
  createdAt: Date;
  fulfilledAt: Date | null;
}) {
  return {
    id: req.id,
    caseId: req.caseId,
    clientId: req.clientId,
    checklistItemId: req.checklistItemId ?? undefined,
    documentType: req.documentType ?? undefined,
    messageId: req.messageId ?? undefined,
    status: req.status,
    fulfilledDocumentId: req.fulfilledDocumentId ?? undefined,
    createdAt: req.createdAt.toISOString(),
    fulfilledAt: req.fulfilledAt?.toISOString() ?? undefined,
  };
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listInfoRequestsForCase(orgId: string, caseId: string) {
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, orgId },
    select: { id: true },
  });
  if (!caseRecord) return { error: 'NOT_FOUND' as const };

  const requests = await prisma.clientInfoRequest.findMany({
    where: { caseId, orgId },
    orderBy: { createdAt: 'desc' },
  });

  return { requests };
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createInfoRequestForCase(
  orgId: string,
  caseId: string,
  input: CreateInfoRequestInput,
  userId?: string,
) {
  // Verify case belongs to org and load client + referenceNumber for the message
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, orgId },
    select: {
      id: true,
      referenceNumber: true,
      clientId: true,
      client: { select: { firstName: true, portalEnabled: true } },
    },
  });
  if (!caseRecord) return { error: 'NOT_FOUND' as const };

  // Build the message body — pre-filled with the document type or checklist item
  const what = input.documentType
    ? input.documentType.toLowerCase().replace(/_/g, ' ')
    : input.checklistItemId
      ? input.checklistItemId.replace(/_/g, ' ')
      : 'the requested document';

  const messageBody =
    input.body?.trim() ||
    `Please upload ${what} for case reference ${caseRecord.referenceNumber}.${
      caseRecord.client.portalEnabled
        ? ' You can upload it directly through your client portal.'
        : ''
    }`;

  const subject = `Document Request — ${caseRecord.referenceNumber}`;

  // Send via existing PRD-10 broadcast path (handles email/SMS/portal/digest)
  const broadcastResult = await broadcastMessageForOrg(orgId, {
    body: messageBody,
    subject,
    direction: 'OUTBOUND',
    sourceType: 'COMPLIANCE',
    caseId,
    clientId: caseRecord.clientId,
  });

  const primaryMessageId = broadcastResult.primary?.id ?? null;

  // Create the ClientInfoRequest record
  const infoRequest = await prisma.clientInfoRequest.create({
    data: {
      orgId,
      caseId,
      clientId: caseRecord.clientId,
      checklistItemId: input.checklistItemId ?? null,
      documentType: input.documentType ?? null,
      messageId: primaryMessageId,
      status: 'OUTSTANDING',
    },
  });

  await logAuditEvent({
    orgId,
    userId,
    entityType: 'Case',
    entityId: caseId,
    action: 'INFO_REQUEST_CREATED',
    diff: {
      after: {
        infoRequestId: infoRequest.id,
        checklistItemId: input.checklistItemId ?? null,
        documentType: input.documentType ?? null,
        messageId: primaryMessageId,
      },
    },
  });

  return { infoRequest, message: broadcastResult.primary, delivery: broadcastResult.delivery };
}

// ── Fulfil by document upload ─────────────────────────────────────────────────

/**
 * Called automatically when a Document is uploaded for a case.
 * Finds all OUTSTANDING requests whose documentType matches and fulfils them.
 */
export async function fulfilInfoRequestsForDocument(
  orgId: string,
  caseId: string,
  documentId: string,
  documentType: string,
) {
  const outstanding = await prisma.clientInfoRequest.findMany({
    where: {
      caseId,
      orgId,
      status: 'OUTSTANDING',
      documentType,
    },
    select: { id: true },
  });

  if (outstanding.length === 0) return { fulfilled: 0 };

  const now = new Date();
  await prisma.clientInfoRequest.updateMany({
    where: { id: { in: outstanding.map((r) => r.id) } },
    data: {
      status: 'FULFILLED',
      fulfilledDocumentId: documentId,
      fulfilledAt: now,
    },
  });

  void logAuditEvent({
    orgId,
    entityType: 'Case',
    entityId: caseId,
    action: 'INFO_REQUEST_FULFILLED',
    diff: {
      ids: outstanding.map((r) => r.id),
      documentId,
      documentType,
      fulfilledAt: now.toISOString(),
    },
  });

  return { fulfilled: outstanding.length };
}

// ── Fulfil by checklist item completion ───────────────────────────────────────

/**
 * Called when an adviser marks a compliance checklist item complete.
 * Finds all OUTSTANDING requests tied to that checklistItemId and fulfils them.
 */
export async function fulfilInfoRequestsForChecklistItem(
  orgId: string,
  caseId: string,
  checklistItemId: string,
) {
  const outstanding = await prisma.clientInfoRequest.findMany({
    where: {
      caseId,
      orgId,
      status: 'OUTSTANDING',
      checklistItemId,
    },
    select: { id: true },
  });

  if (outstanding.length === 0) return { fulfilled: 0 };

  const now = new Date();
  await prisma.clientInfoRequest.updateMany({
    where: { id: { in: outstanding.map((r) => r.id) } },
    data: {
      status: 'FULFILLED',
      fulfilledAt: now,
    },
  });

  void logAuditEvent({
    orgId,
    entityType: 'Case',
    entityId: caseId,
    action: 'INFO_REQUEST_FULFILLED',
    diff: {
      ids: outstanding.map((r) => r.id),
      checklistItemId,
      fulfilledAt: now.toISOString(),
    },
  });

  return { fulfilled: outstanding.length };
}
