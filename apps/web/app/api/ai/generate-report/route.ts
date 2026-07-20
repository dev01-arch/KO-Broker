/**
 * POST /api/ai/generate-report
 *
 * Generates a new AI suitability report for a case.
 * Validates preconditions (fact-find complete, product selected, ≥3 products considered),
 * constructs the prompt, calls Azure AI Foundry, and stores the report as DRAFT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { requireVisibility } from '@/lib/auth';
import { buildReportPrompt, SYSTEM_PROMPT, type ReportTemplate as PromptTemplate } from '@/lib/ai/buildReportPrompt';
import { callOpenRouter, AI_AVAILABLE } from '@/lib/ai/azureClient';
import { ReportTemplate } from '@ko/db';
import { GenerateReportSchema } from '@ko/types';


export const POST = createHandler({
    method: 'POST',
    requiredFeature: 'ai_reports',
    schema: GenerateReportSchema,
    handler: async (_req: NextRequest, { body, user, orgId }) => {
        // Enforce AI summary visibility switch
        await requireVisibility('canViewAiSummaries');

        const { caseId, templateType } = body;

        // Fetch case with all required relations
        const caseRecord = await prisma.case.findFirst({
            where: { id: caseId, orgId },
            include: {
                client: true,
                factFind: true,
                productsConsidered: true,
            },
        });

        if (!caseRecord) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Case not found' } },
                { status: 404 }
            );
        }

        // Precondition: fact-find must be complete
        if (!caseRecord.factFind || !caseRecord.factFind.completedAt) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: 'Fact-find must be completed before generating a report.',
                    },
                },
                { status: 422 }
            );
        }

        // Precondition: minimum 3 products considered
        if (caseRecord.productsConsidered.length < 3) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: `At least 3 products must be recorded. Found: ${caseRecord.productsConsidered.length}.`,
                    },
                },
                { status: 422 }
            );
        }

        // Precondition: a product must be selected
        const hasSelectedProduct =
            caseRecord.productsConsidered.some((p) => p.isSelected) ||
            (caseRecord.selectedProduct && caseRecord.selectedLender);

        if (!hasSelectedProduct) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: 'A product must be selected before generating a report.',
                    },
                },
                { status: 422 }
            );
        }

        // Build prompt
        let selectedProduct = caseRecord.productsConsidered.find((p) => p.isSelected) ?? null;
        if (!selectedProduct && caseRecord.selectedProduct && caseRecord.selectedLender) {
            selectedProduct = {
                id: 'selected-fallback',
                lenderName: caseRecord.selectedLender,
                productName: caseRecord.selectedProduct,
                rate: caseRecord.selectedRate,
                fee: caseRecord.selectedFee,
                isSelected: true,
                caseId: caseRecord.id,
            } as unknown as (typeof caseRecord.productsConsidered)[number];
        }
        const userPrompt = buildReportPrompt({
            templateType: templateType as PromptTemplate,
            client: caseRecord.client as Record<string, unknown>,
            caseData: {
                id: caseRecord.id,
                referenceNumber: caseRecord.referenceNumber,
                type: caseRecord.type,
                stage: caseRecord.stage,
                propertyValue: caseRecord.propertyValue,
                loanAmount: caseRecord.loanAmount,
                ltv: caseRecord.ltv,
                termYears: caseRecord.termYears,
                selectedLender: caseRecord.selectedLender,
                selectedProduct: caseRecord.selectedProduct,
                selectedRate: caseRecord.selectedRate,
            },
            productsConsidered: caseRecord.productsConsidered as Record<string, unknown>[],
            selectedProduct: selectedProduct as Record<string, unknown> | null,
            adviserNotes: caseRecord.adviserNotes,
            isVulnerable: caseRecord.client.isVulnerable ?? false,
        });

        // Call OpenRouter
        if (!AI_AVAILABLE) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'OpenRouter is not configured. Set OPENROUTER_API_KEY.',
                    },
                },
                { status: 503 }
            );
        }

        const rawResponse = await callOpenRouter([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ]);

        const parsed = JSON.parse(rawResponse);

        // Create SuitabilityReport record as DRAFT
        const report = await prisma.suitabilityReport.create({
            data: {
                caseId,
                templateType: templateType as ReportTemplate,
                status: 'DRAFT',
                sections: parsed.sections ?? [],
                generatedBy: user?.id ?? null,
            },
        });

        await logAuditEvent({
            orgId: orgId!,
            userId: user?.id,
            entityType: 'SuitabilityReport',
            entityId: report.id,
            action: 'REPORT_GENERATED',
            diff: {
                after: {
                    caseId,
                    templateType,
                    status: 'DRAFT',
                    sectionsCount: (parsed.sections ?? []).length,
                },
            },
        });

        return NextResponse.json({ success: true, data: report }, { status: 201 });
    },
});
