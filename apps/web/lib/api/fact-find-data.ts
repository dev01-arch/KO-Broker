import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { computeDiff, logAuditEvent } from '@/lib/compliance/audit';
import { calculateVulnerabilityScore, checkIsVulnerable } from '@/lib/compliance/vulnerability';
import type { UpsertFactFindInput } from '@ko/types';

function shouldUseDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

export type FactFindUpsertResult =
  | {
      factFind: Awaited<ReturnType<typeof prisma.factFind.upsert>>;
      client: { id: string; isVulnerable: boolean };
    }
  | { error: 'NOT_FOUND' }
  | { error: 'FORBIDDEN'; message: string };

export async function upsertFactFindWithCompliance(
  orgId: string,
  caseId: string,
  input: UpsertFactFindInput,
  options?: { userId?: string; allowWhenComplete?: boolean },
): Promise<FactFindUpsertResult> {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: caseId, orgId },
      include: { client: true, factFind: true },
    });
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    if (
      !options?.allowWhenComplete &&
      caseRecord.factFind?.completedAt &&
      !input.markComplete
    ) {
      return {
        error: 'FORBIDDEN' as const,
        message: 'This fact-find is already complete and cannot be edited.',
      };
    }

    let newIsVulnerable = caseRecord.client.isVulnerable;

    if (input.clientPreferences) {
      const questionnaire =
        (input.clientPreferences.vulnerabilityAnswers as Record<string, unknown>) ||
        input.clientPreferences;
      const score = calculateVulnerabilityScore(questionnaire);
      newIsVulnerable = checkIsVulnerable(score);

      if (newIsVulnerable !== caseRecord.client.isVulnerable) {
        const existingClient = { ...caseRecord.client };
        const updatedClient = await prisma.client.update({
          where: { id: caseRecord.clientId },
          data: {
            isVulnerable: newIsVulnerable,
            vulnerabilityNotes:
              (input.clientPreferences.vulnerabilityNotes as string) || undefined,
          },
        });

        await logAuditEvent({
          orgId,
          userId: options?.userId,
          entityType: 'Client',
          entityId: caseRecord.clientId,
          action: 'CLIENT_UPDATED',
          diff: computeDiff(
            existingClient as unknown as Record<string, unknown>,
            updatedClient as unknown as Record<string, unknown>,
          ),
        });
      }
    }

    const { markComplete, ...sections } = input;
    const sectionData = Object.fromEntries(
      Object.entries(sections).filter(([, value]) => value !== undefined),
    );

    const existingFactFind = caseRecord.factFind;
    const factFind = await prisma.factFind.upsert({
      where: { caseId },
      create: {
        caseId,
        ...sectionData,
        ...(markComplete ? { completedAt: new Date() } : {}),
      },
      update: {
        ...sectionData,
        ...(markComplete
          ? { completedAt: new Date() }
          : markComplete === false
            ? { completedAt: null }
            : {}),
      },
    });

    await logAuditEvent({
      orgId,
      userId: options?.userId,
      entityType: 'Case',
      entityId: caseId,
      action: markComplete ? 'FACT_FIND_COMPLETED' : 'FACT_FIND_UPDATED',
      diff: computeDiff(
        (existingFactFind ?? {}) as unknown as Record<string, unknown>,
        factFind as unknown as Record<string, unknown>,
      ),
    });

    // Completing a fact-find while still at ENQUIRY should move the case into FACT_FIND
    // so the next compliance advance is RESEARCH (not blocked on disclosure alone).
    if (markComplete && caseRecord.stage === 'ENQUIRY') {
      await prisma.$transaction(async (tx) => {
        await tx.complianceRecord.create({
          data: {
            caseId,
            stage: 'INITIAL_DISCLOSURE',
            completedAt: new Date(),
            isApproved: true,
            userId: options?.userId ?? null,
          },
        });
        await tx.case.update({
          where: { id: caseId },
          data: { stage: 'FACT_FIND', updatedAt: new Date() },
        });
      });

      await logAuditEvent({
        orgId,
        userId: options?.userId,
        entityType: 'Case',
        entityId: caseId,
        action: 'CASE_STAGE_CHANGED',
        diff: {
          stage: { before: 'ENQUIRY', after: 'FACT_FIND' },
          reason: 'Fact-find completed while case was at ENQUIRY',
        },
      });
    }

    return { factFind, client: { id: caseRecord.clientId, isVulnerable: newIsVulnerable } };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    const fallback = devStore.upsertFactFind(orgId, caseId, input);
    if ('error' in fallback) return { error: 'NOT_FOUND' as const };
    return {
      factFind: fallback.factFind as Awaited<ReturnType<typeof prisma.factFind.upsert>>,
      client: { id: '', isVulnerable: false },
    };
  }
}

export async function completePortalFactFind(session: {
  clientId: string;
  orgId: string;
  caseId: string;
}) {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: {
        id: session.caseId,
        orgId: session.orgId,
        clientId: session.clientId,
      },
      include: {
        client: true,
        factFind: true,
        adviser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!caseRecord) return { error: 'NOT_FOUND' as const };
    if (!caseRecord.factFind) return { error: 'NOT_FOUND' as const, message: 'Fact-Find not initialized' };

    if (caseRecord.factFind.completedAt) {
      return { factFind: caseRecord.factFind, alreadyComplete: true };
    }

    const completedDate = new Date();
    const updatedFactFind = await prisma.factFind.update({
      where: { id: caseRecord.factFind.id },
      data: { completedAt: completedDate },
    });

    const preferences =
      (caseRecord.factFind.clientPreferences as Record<string, unknown>) || {};
    const questionnaire =
      (preferences.vulnerabilityAnswers as Record<string, unknown>) || preferences;
    const score = calculateVulnerabilityScore(questionnaire);
    const newIsVulnerable = checkIsVulnerable(score);

    if (newIsVulnerable !== caseRecord.client.isVulnerable) {
      const existingClient = { ...caseRecord.client };
      const updatedClient = await prisma.client.update({
        where: { id: caseRecord.client.id },
        data: { isVulnerable: newIsVulnerable },
      });

      await logAuditEvent({
        orgId: session.orgId,
        entityType: 'Client',
        entityId: caseRecord.client.id,
        action: 'CLIENT_UPDATED',
        diff: computeDiff(
          existingClient as unknown as Record<string, unknown>,
          updatedClient as unknown as Record<string, unknown>,
        ),
      });
    }

    await logAuditEvent({
      orgId: session.orgId,
      entityType: 'Case',
      entityId: session.caseId,
      action: 'FACT_FIND_COMPLETED',
      diff: {
        after: {
          completedAt: completedDate,
          isVulnerable: newIsVulnerable,
        },
      },
    });

    await prisma.message.create({
      data: {
        orgId: session.orgId,
        caseId: session.caseId,
        clientId: session.clientId,
        direction: 'INBOUND',
        channel: 'IN_APP',
        sourceType: 'CLIENT_REPLY',
        body: 'I have completed my Fact-Find questionnaire and submitted it for review.',
      },
    });

    if (caseRecord.stage === 'ENQUIRY') {
      await prisma.$transaction(async (tx) => {
        await tx.complianceRecord.create({
          data: {
            caseId: session.caseId,
            stage: 'INITIAL_DISCLOSURE',
            completedAt: completedDate,
            isApproved: true,
          },
        });
        await tx.case.update({
          where: { id: session.caseId },
          data: { stage: 'FACT_FIND', updatedAt: new Date() },
        });
      });

      await logAuditEvent({
        orgId: session.orgId,
        entityType: 'Case',
        entityId: session.caseId,
        action: 'CASE_STAGE_CHANGED',
        diff: {
          stage: { before: 'ENQUIRY', after: 'FACT_FIND' },
          reason: 'Fact-find completed while case was at ENQUIRY',
        },
      });
    }

    const adviser = caseRecord.adviser;
    if (adviser?.email) {
      const { deliverEmail } = await import('@/lib/notifications/email');
      const adviserName = adviser.firstName || 'Adviser';
      const clientName = `${caseRecord.client.firstName} ${caseRecord.client.lastName}`.trim();
      const subject = `Fact-Find Completed: Client ${clientName}`;
      const body = `Hello ${adviserName},\n\nYour client ${clientName} has completed their Fact-Find questionnaire for Case Ref ${caseRecord.referenceNumber}.\n\nYou can now review the information on your dashboard and proceed with the research or AI Suitability Report generation.\n\nBest regards,\nKO Broker Platform`;
      const html = `
        <p>Hello ${adviserName},</p>
        <p>Your client <strong>${clientName}</strong> has completed their Fact-Find questionnaire for case <strong>${caseRecord.referenceNumber}</strong>.</p>
        <p>You can now review the information on your dashboard and proceed with the research or AI Suitability Report generation.</p>
        <p>Best regards,<br/>KO Broker Platform</p>
      `;
      await deliverEmail({ to: adviser.email, subject, body, html }).catch((err) => {
        console.error('[NOTIFY ERROR] Failed to send complete email to adviser:', err);
      });
    }

    return { factFind: updatedFactFind, alreadyComplete: false };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    const result = devStore.upsertFactFind(session.orgId, session.caseId, { markComplete: true });
    if ('error' in result) return result;
    return { factFind: result.factFind, alreadyComplete: false };
  }
}
