/**
 * Case notes data layer — PRD-16 W2
 *
 * CaseNote is INSERT-ONLY. There are no update or delete operations.
 * tag values in use: intel | disclosure | amend | system
 */

import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import type { CreateCaseNoteInput } from '@ko/types';

export function serializeCaseNote(note: {
  id: string;
  caseId: string;
  orgId: string;
  body: string;
  tag: string | null;
  source: string;
  authorUserId: string | null;
  createdAt: Date;
  author?: { id: string; firstName: string | null; lastName: string | null } | null;
}) {
  return {
    id: note.id,
    caseId: note.caseId,
    body: note.body,
    tag: note.tag ?? undefined,
    source: note.source,
    authorUserId: note.authorUserId ?? undefined,
    author: note.author
      ? {
          id: note.author.id,
          firstName: note.author.firstName,
          lastName: note.author.lastName,
        }
      : undefined,
    createdAt: note.createdAt.toISOString(),
  };
}

/**
 * listNotesForCase — returns all notes ordered oldest-first.
 */
export async function listNotesForCase(orgId: string, caseId: string) {
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, orgId },
    select: { id: true },
  });
  if (!caseRecord) return { error: 'NOT_FOUND' as const };

  const notes = await prisma.caseNote.findMany({
    where: { caseId, orgId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return { notes };
}

/**
 * createNoteForCase — inserts a new CaseNote. INSERT-ONLY.
 */
export async function createNoteForCase(
  orgId: string,
  caseId: string,
  input: CreateCaseNoteInput,
  userId?: string,
  source: 'ADVISER' | 'INTEL' | 'SYSTEM' = 'ADVISER',
) {
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, orgId },
    select: { id: true },
  });
  if (!caseRecord) return { error: 'NOT_FOUND' as const };

  const note = await prisma.caseNote.create({
    data: {
      orgId,
      caseId,
      body: input.body,
      tag: input.tag ?? null,
      authorUserId: userId ?? null,
      source,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await logAuditEvent({
    orgId,
    userId,
    entityType: 'Case',
    entityId: caseId,
    action: 'CASE_NOTE_ADDED',
    diff: { body: input.body, tag: input.tag ?? null, source },
  });

  return { note };
}
