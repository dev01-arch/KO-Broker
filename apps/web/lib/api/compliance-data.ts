import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { logAuditEvent } from '@/lib/compliance/audit';
import {
  CASE_TO_COMPLIANCE_STAGE,
  COMPLIANCE_TO_CASE_STAGE,
  STAGE_SEQUENCE,
  caseStageToComplianceTarget,
  verifyStageChecklist,
  type ComplianceStage,
} from '@/lib/compliance/workflow';
import {
  sendEsisNotification,
  sendFactFindConfirmation,
  sendRecommendationNotification,
  sendResearchUpdate,
  sendWelcomeNotification,
} from '@/lib/notifications/email';
import {
  sendSMSEsisNotification,
  sendSMSFactFindConfirmation,
  sendSMSRecommendationNotification,
  sendSMSResearchUpdate,
  sendSMSWelcomeNotification,
} from '@/lib/notifications/sms';
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
    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, orgId },
      include: { client: true },
    });
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const currentCompliance = CASE_TO_COMPLIANCE_STAGE[caseRecord.stage];
    if (!currentCompliance) {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: `Case stage '${caseRecord.stage}' is not a valid compliance stage or is already completed.`,
      };
    }

    const targetCompliance = caseStageToComplianceTarget(toStage);
    const currentIdx = STAGE_SEQUENCE.indexOf(currentCompliance);
    const expectedNextStage =
      currentIdx === STAGE_SEQUENCE.length - 1 ? 'COMPLETION' : STAGE_SEQUENCE[currentIdx + 1];

    if (targetCompliance !== expectedNextStage) {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: `Invalid stage progression. Cannot advance from ${currentCompliance} to ${targetCompliance}. Expected: ${expectedNextStage}.`,
        details: [`Current: ${currentCompliance}`, `Expected next: ${expectedNextStage}`],
      };
    }

    const checklist = await verifyStageChecklist(caseId, orgId, currentCompliance);
    if (!checklist.isComplete) {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: 'Compliance checklist verification failed for current stage.',
        details: checklist.missingItems,
      };
    }

    const targetCaseStage: CaseStage =
      targetCompliance === 'COMPLETION'
        ? 'COMPLETION'
        : COMPLIANCE_TO_CASE_STAGE[targetCompliance as ComplianceStage];

    const updatedCase = await prisma.$transaction(async (tx) => {
      await tx.complianceRecord.create({
        data: {
          caseId,
          stage: currentCompliance,
          completedAt: new Date(),
          isApproved: true,
          userId: userId ?? null,
        },
      });

      return tx.case.update({
        where: { id: caseId },
        data: {
          stage: targetCaseStage,
          updatedAt: new Date(),
        },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          adviser: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { messages: true, documents: true } },
        },
      });
    });

    await logAuditEvent({
      orgId,
      userId,
      entityType: 'Case',
      entityId: caseId,
      action: 'CASE_STAGE_CHANGED',
      diff: {
        stage: { before: caseRecord.stage, after: targetCaseStage },
        notes,
      },
      notificationSent: true,
    });

    await prisma.message.create({
      data: {
        orgId,
        caseId,
        clientId: caseRecord.clientId,
        direction: 'SYSTEM',
        channel: 'IN_APP',
        sourceType: 'COMPLIANCE',
        body: `Compliance stage completed: ${currentCompliance}. Case advanced to ${targetCompliance}.`,
      },
    });

    const clientEmail = caseRecord.client.email;
    const clientPhone = caseRecord.client.phone;

    try {
      if (currentCompliance === 'INITIAL_DISCLOSURE') {
        await sendWelcomeNotification(orgId, caseId, caseRecord.clientId, clientEmail);
        if (clientPhone) {
          await sendSMSWelcomeNotification(orgId, caseId, caseRecord.clientId, clientPhone);
        }
      } else if (currentCompliance === 'FACT_FIND') {
        await sendFactFindConfirmation(orgId, caseId, caseRecord.clientId, clientEmail);
        if (clientPhone) {
          await sendSMSFactFindConfirmation(orgId, caseId, caseRecord.clientId, clientPhone);
        }
      } else if (currentCompliance === 'RESEARCH') {
        await sendResearchUpdate(orgId, caseId, caseRecord.clientId, clientEmail);
        if (clientPhone) {
          await sendSMSResearchUpdate(orgId, caseId, caseRecord.clientId, clientPhone);
        }
      } else if (currentCompliance === 'ESIS') {
        await sendEsisNotification(orgId, caseId, caseRecord.clientId, clientEmail);
        if (clientPhone) {
          await sendSMSEsisNotification(orgId, caseId, caseRecord.clientId, clientPhone);
        }
      } else if (currentCompliance === 'SUITABILITY_REPORT') {
        await sendRecommendationNotification(orgId, caseId, caseRecord.clientId, clientEmail);
        if (clientPhone) {
          await sendSMSRecommendationNotification(orgId, caseId, caseRecord.clientId, clientPhone);
        }
      }
    } catch (err) {
      console.error('[NOTIFICATION ERROR] Failed to send client notifications:', err);
    }

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
