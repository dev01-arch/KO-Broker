/**
 * Audit trail logger — PRD-07
 *
 * INSERT-ONLY audit log. No UPDATE or DELETE on AuditLog.
 * Called by every mutation handler.
 */

import { type Prisma } from '@ko/db';
import { prisma } from '../db';
import { diff } from 'deep-diff';
import { isPrismaForeignKeyError } from '../api/prisma-errors';

interface AuditEventInput {
    orgId: string;
    userId?: string;
    entityType: string;
    entityId: string;
    action: string;
    diff?: unknown;
    notificationSent?: boolean;
}

async function resolveAuditUserId(userId?: string): Promise<string | null> {
    if (!userId) return null;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        return user ? userId : null;
    } catch {
        return null;
    }
}

/**
 * logAuditEvent — inserts an immutable audit record.
 * This is the ONLY way to write to the AuditLog table.
 * Never call prisma.auditLog.update() or prisma.auditLog.delete().
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
    const userId = await resolveAuditUserId(input.userId);

    try {
        await prisma.auditLog.create({
            data: {
                orgId: input.orgId,
                userId,
                entityType: input.entityType,
                entityId: input.entityId,
                action: input.action,
                diff: (input.diff ?? undefined) as Prisma.InputJsonValue | undefined,
                notificationSent: input.notificationSent ?? false,
            },
        });
    } catch (error) {
        // Dev-store auth can yield a user id that is not in Postgres when the DB recovers mid-request.
        if (input.userId && isPrismaForeignKeyError(error, 'audit_logs_userId_fkey')) {
            await prisma.auditLog.create({
                data: {
                    orgId: input.orgId,
                    userId: null,
                    entityType: input.entityType,
                    entityId: input.entityId,
                    action: input.action,
                    diff: (input.diff ?? undefined) as Prisma.InputJsonValue | undefined,
                    notificationSent: input.notificationSent ?? false,
                },
            });
            console.warn('[audit] userId not in database — logged event without user');
            return;
        }
        throw error;
    }
}

/**
 * computeDiff — deep diff between two plain objects.
 * Returns an array of deep-diff change objects or null if no differences.
 */
export function computeDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>
): unknown {
    const beforeObj = JSON.parse(JSON.stringify(before));
    const afterObj = JSON.parse(JSON.stringify(after));

    // Exclude transient fields that change automatically
    delete beforeObj.updatedAt;
    delete afterObj.updatedAt;

    const changes = diff(beforeObj, afterObj);
    return changes || null;
}
