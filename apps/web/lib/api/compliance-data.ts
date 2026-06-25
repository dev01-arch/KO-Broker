import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { validateStageTransition } from '@/lib/api/stage-transition';
import type { CaseStage } from '@ko/types';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

export async function advanceCaseStage(
  orgId: string,
  caseId: string,
  toStage: CaseStage,
  userId?: string,
  notes?: string,
) {
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, orgId } });
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const transitionError = validateStageTransition(caseRecord.stage, toStage);
    if (transitionError !== null) {
      return { error: 'BUSINESS_RULE_VIOLATION' as const, message: transitionError };
    }

    const [updatedCase] = await prisma.$transaction([
      prisma.case.update({
        where: { id: caseId },
        data: { stage: toStage, updatedAt: new Date() },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
          adviser: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { messages: true, documents: true } },
        },
      }),
      prisma.complianceRecord.create({
        data: {
          caseId,
          stage: toStage,
          isApproved: true,
          ...(userId ? { userId } : {}),
          completedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          orgId,
          entityType: 'case',
          entityId: caseId,
          action: 'stage_advanced',
          diff: { from: caseRecord.stage, to: toStage, notes },
          ...(userId ? { user: { connect: { id: userId } } } : {}),
        },
      }),
    ]);

    return { case: updatedCase };
  } catch (error) {
    if (useDevStore(error)) {
      const stored = devStore.updateCase(orgId, caseId, { stage: toStage });
      if ('error' in stored) return stored;
      devStore.addAuditLog({
        orgId,
        userId,
        entityType: 'case',
        entityId: caseId,
        action: 'stage_advanced',
        diff: { to: toStage, notes },
      });
      return stored;
    }
    throw error;
  }
}
