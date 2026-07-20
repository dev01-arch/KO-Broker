import { NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { requirePortalAuth } from '@/lib/auth/portalAuth';
import { calculateVulnerabilityScore, checkIsVulnerable } from '@/lib/compliance/vulnerability';
import { deliverEmail } from '@/lib/notifications/email';
import { logAuditEvent, computeDiff } from '@/lib/compliance/audit';

export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  handler: async () => {
    const client = await requirePortalAuth();
    const activeCase = client.cases[0];

    if (!activeCase) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active case found' } },
        { status: 404 }
      );
    }

    const factFind = activeCase.factFind;
    if (!factFind) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Fact-Find not initialized' } },
        { status: 404 }
      );
    }

    // If already complete, return it
    if (factFind.completedAt) {
      return NextResponse.json(
        { success: true, data: factFind, message: 'Fact-Find already complete' },
        { status: 200 }
      );
    }

    // 1. Mark complete
    const completedDate = new Date();
    const updatedFactFind = await prisma.factFind.update({
      where: { id: factFind.id },
      data: {
        completedAt: completedDate,
      },
    });

    // 2. Vulnerability Assessment Scoring (Step 7)
    let isVulnerable = client.isVulnerable;
    const preferences = (factFind.clientPreferences as Record<string, unknown>) || ({} as Record<string, unknown>);
    const questionnaire = (preferences.vulnerabilityAnswers as Record<string, unknown>) || preferences;
    const score = calculateVulnerabilityScore(questionnaire);
    const newIsVulnerable = checkIsVulnerable(score);

    if (newIsVulnerable !== client.isVulnerable) {
      isVulnerable = newIsVulnerable;
      const updatedClient = await prisma.client.update({
        where: { id: client.id },
        data: {
          isVulnerable: newIsVulnerable,
        },
      });

      const clientDiff = computeDiff(
        client as unknown as Record<string, unknown>,
        updatedClient as unknown as Record<string, unknown>
      );

      await logAuditEvent({
        orgId: client.orgId,
        entityType: 'Client',
        entityId: client.id,
        action: 'CLIENT_UPDATED',
        diff: clientDiff,
      });
    }

    // 3. Log compliance audit event
    await logAuditEvent({
      orgId: client.orgId,
      entityType: 'Case',
      entityId: activeCase.id,
      action: 'FACT_FIND_COMPLETED',
      diff: {
        after: {
          completedAt: completedDate,
          isVulnerable,
        },
      },
    });

    // 4. Create INBOUND Message in chat thread
    await prisma.message.create({
      data: {
        orgId: client.orgId,
        caseId: activeCase.id,
        clientId: client.id,
        direction: 'INBOUND',
        channel: 'IN_APP',
        sourceType: 'CLIENT_REPLY',
        body: 'I have completed my Fact-Find questionnaire and submitted it for review.',
      },
    });

    // 5. Notify assigned broker/adviser via Email
    if (activeCase.assignedAdviserId) {
      const adviser = await prisma.user.findUnique({
        where: { id: activeCase.assignedAdviserId },
      });

      if (adviser && adviser.email) {
        await deliverEmail({
          to: adviser.email,
          subject: `Fact-Find Completed: Client ${client.firstName} ${client.lastName}`,
          body: `Hello ${adviser.firstName || 'Adviser'},\n\nYour client ${client.firstName} ${client.lastName} has completed their Fact-Find questionnaire for Case Ref ${activeCase.referenceNumber}.\n\nYou can now review the information on your dashboard and proceed with the research or AI Suitability Report generation.\n\nBest regards,\nKO Broker Platform`,
        }).catch((err) => {
          console.error('[NOTIFY ERROR] Failed to send complete email to adviser:', err);
        });
      }
    }

    return NextResponse.json(
      { success: true, data: updatedFactFind },
      { status: 200 }
    );
  },
});
