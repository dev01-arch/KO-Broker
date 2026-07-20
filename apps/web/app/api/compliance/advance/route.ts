/**
 * POST /api/compliance/advance
 * 
 * Advances the compliance stage of a case.
 * Performs stage-skip prevention, checklist validation, updates case.stage,
 * logs audit event, and triggers client notifications (email + SMS).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import {
    ComplianceStage,
    verifyStageChecklist,
    STAGE_SEQUENCE,
    COMPLIANCE_TO_CASE_STAGE,
    CASE_TO_COMPLIANCE_STAGE
} from '@/lib/compliance/workflow';
import { CaseStage } from '@ko/db';
import {
    sendWelcomeNotification,
    sendFactFindConfirmation,
    sendResearchUpdate,
    sendEsisNotification,
    sendRecommendationNotification
} from '@/lib/notifications/email';
import {
    sendSMSWelcomeNotification,
    sendSMSFactFindConfirmation,
    sendSMSResearchUpdate,
    sendSMSEsisNotification,
    sendSMSRecommendationNotification
} from '@/lib/notifications/sms';
import { AdvanceComplianceStageSchema } from '@ko/types';

const AdvanceStageSchema = AdvanceComplianceStageSchema;

export const POST = createHandler({
    method: 'POST',
    schema: AdvanceStageSchema,
    handler: async (_req: NextRequest, { body, user, orgId }) => {
        const { caseId, targetStage } = body;

        // Fetch case with relations to verify and fetch client details
        const caseRecord = await prisma.case.findFirst({
            where: { id: caseId, orgId },
            include: { client: true },
        });

        if (!caseRecord) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
                { status: 404 }
            );
        }

        // Determine current compliance stage from CaseStage
        const currentStage = CASE_TO_COMPLIANCE_STAGE[caseRecord.stage];
        if (!currentStage) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: `Case stage '${caseRecord.stage}' is not a valid compliance stage or is already completed.`,
                    },
                },
                { status: 422 }
            );
        }

        // Validate linear sequence (no stage-skipping)
        const currentIdx = STAGE_SEQUENCE.indexOf(currentStage);
        const expectedNextStage = currentIdx === STAGE_SEQUENCE.length - 1 ? 'COMPLETION' : STAGE_SEQUENCE[currentIdx + 1];

        if (targetStage !== expectedNextStage) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: `Invalid stage progression. Cannot advance from ${currentStage} to ${targetStage}. Expected: ${expectedNextStage}.`,
                    },
                },
                { status: 422 }
            );
        }

        // Verify stage checklist
        const checklist = await verifyStageChecklist(caseId, orgId!, currentStage);
        if (!checklist.isComplete) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: 'Compliance checklist verification failed for current stage.',
                        details: checklist.missingItems,
                    },
                },
                { status: 422 }
            );
        }

        // Determine target case stage from compliance mapping
        const targetCaseStage = targetStage === 'COMPLETION' ? 'COMPLETION' : COMPLIANCE_TO_CASE_STAGE[targetStage as ComplianceStage];

        // Execute stage change in a transaction
        const updatedCase = await prisma.$transaction(async (tx) => {
            // 1. Create ComplianceRecord for the COMPLETED stage
            await tx.complianceRecord.create({
                data: {
                    caseId,
                    stage: currentStage,
                    completedAt: new Date(),
                    isApproved: true,
                    userId: user?.id ?? null,
                },
            });

            // 2. Update Case.stage
            const uc = await tx.case.update({
                where: { id: caseId },
                data: {
                    stage: targetCaseStage as CaseStage,
                    updatedAt: new Date(),
                },
            });

            return uc;
        });

        // Log audit event
        await logAuditEvent({
            orgId: orgId!,
            userId: user?.id,
            entityType: 'Case',
            entityId: caseId,
            action: 'CASE_STAGE_CHANGED',
            diff: {
                stage: {
                    before: caseRecord.stage,
                    after: targetCaseStage,
                },
            },
            notificationSent: true,
        });

        // Insert System Message record
        await prisma.message.create({
            data: {
                orgId: orgId!,
                caseId,
                clientId: caseRecord.clientId,
                direction: 'SYSTEM',
                channel: 'IN_APP',
                sourceType: 'COMPLIANCE',
                body: `Compliance stage completed: ${currentStage}. Case advanced to ${targetStage}.`,
            },
        });

        // Trigger Notifications asynchronously/after transaction success
        const clientEmail = caseRecord.client.email;
        const clientPhone = caseRecord.client.phone;

        try {
            if (currentStage === 'INITIAL_DISCLOSURE') {
                await sendWelcomeNotification(orgId!, caseId, caseRecord.clientId, clientEmail);
                if (clientPhone) {
                    await sendSMSWelcomeNotification(orgId!, caseId, caseRecord.clientId, clientPhone);
                }
            } else if (currentStage === 'FACT_FIND') {
                await sendFactFindConfirmation(orgId!, caseId, caseRecord.clientId, clientEmail);
                if (clientPhone) {
                    await sendSMSFactFindConfirmation(orgId!, caseId, caseRecord.clientId, clientPhone);
                }
            } else if (currentStage === 'RESEARCH') {
                await sendResearchUpdate(orgId!, caseId, caseRecord.clientId, clientEmail);
                if (clientPhone) {
                    await sendSMSResearchUpdate(orgId!, caseId, caseRecord.clientId, clientPhone);
                }
            } else if (currentStage === 'ESIS') {
                await sendEsisNotification(orgId!, caseId, caseRecord.clientId, clientEmail);
                if (clientPhone) {
                    await sendSMSEsisNotification(orgId!, caseId, caseRecord.clientId, clientPhone);
                }
            } else if (currentStage === 'SUITABILITY_REPORT') {
                await sendRecommendationNotification(orgId!, caseId, caseRecord.clientId, clientEmail);
                if (clientPhone) {
                    await sendSMSRecommendationNotification(orgId!, caseId, caseRecord.clientId, clientPhone);
                }
            }
        } catch (err) {
            console.error('[NOTIFICATION ERROR] Failed to send client notifications:', err);
        }

        return NextResponse.json({
            success: true,
            data: updatedCase,
        }, { status: 200 });
    },
});
