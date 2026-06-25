import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

export async function listTimelineForCase(
  orgId: string,
  caseId: string,
  params: { page: number; perPage: number },
) {
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, orgId } });
    if (!caseRecord) return null;

    const where = { orgId, entityId: caseId };
    const [total, entries] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);
    return { total, entries };
  } catch (error) {
    if (useDevStore(error)) {
      const result = devStore.listTimeline(orgId, caseId, params);
      return { total: result.total, entries: result.entries };
    }
    throw error;
  }
}

export async function addTimelineEntry(entry: {
  orgId: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Record<string, unknown>;
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        orgId: entry.orgId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        diff: entry.diff,
        ...(entry.userId ? { user: { connect: { id: entry.userId } } } : {}),
      },
    });
  } catch (error) {
    if (useDevStore(error)) return devStore.addAuditLog(entry);
    throw error;
  }
}
