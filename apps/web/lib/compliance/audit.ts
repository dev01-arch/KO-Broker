/**
 * Audit trail logger — PRD-07
 *
 * INSERT-ONLY audit log. No UPDATE or DELETE on AuditLog.
 * Called by every mutation handler.
 */

import { type Prisma } from '@ko/db';
import { prisma } from '@/lib/db';
import { diff } from 'deep-diff';

interface AuditEventInput {
  orgId: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: unknown;
  notificationSent?: boolean;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId: input.orgId,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      diff: (input.diff ?? undefined) as Prisma.InputJsonValue | undefined,
      notificationSent: input.notificationSent ?? false,
    },
  });
}

export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): unknown {
  const beforeObj = JSON.parse(JSON.stringify(before));
  const afterObj = JSON.parse(JSON.stringify(after));

  delete beforeObj.updatedAt;
  delete afterObj.updatedAt;

  const changes = diff(beforeObj, afterObj);
  return changes || null;
}
