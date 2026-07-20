/**
 * POST /api/ai/regenerate-section
 *
 * Regenerates a single section of an existing suitability report.
 * Replaces only the target section; all other sections remain unchanged.
 * Resets the section's complianceFlag to REVIEW_REQUIRED after regeneration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/db';
import { Prisma } from '@ko/db';
import { logAuditEvent } from '@/lib/compliance/audit';
import { requireVisibility } from '@/lib/auth';
import { SYSTEM_PROMPT } from '@/lib/ai/buildReportPrompt';
import { callOpenRouter, AI_AVAILABLE } from '@/lib/ai/azureClient';
import type { ReportSection } from '@/lib/ai/complianceCheck';
import { RegenerateSectionSchema } from '@ko/types';


export const POST = createHandler({
    method: 'POST',
    requiredFeature: 'ai_reports',
    // === FRONTEND ADDITION: avoid ZodEffects vs ZodType generic mismatch ===
    // schema validated manually below
    handler: async (req: NextRequest, { user, orgId }) => {
        await requireVisibility('canViewAiSummaries');

        let raw: unknown;
        try {
            raw = await req.json();
        } catch {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
                { status: 422 }
            );
        }
        const validated = RegenerateSectionSchema.safeParse(raw);
        if (!validated.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Request validation failed',
                        fields: validated.error.flatten().fieldErrors,
                    },
                },
                { status: 422 }
            );
        }
        const body = validated.data;
        const { reportId, sectionId, adviserContext } = body;

        // Fetch the report and verify org boundary
        const report = await prisma.suitabilityReport.findFirst({
            where: {
                id: reportId,
                case: { orgId },
            },
            include: {
                case: {
                    include: {
                        client: true,
                        productsConsidered: true,
                    },
                },
            },
        });

        if (!report) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } },
                { status: 404 }
            );
        }

        // Cannot regenerate a finalised report
        if (report.status === 'FINALISED') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'BUSINESS_RULE_VIOLATION',
                        message: 'Cannot regenerate sections of a finalised report.',
                    },
                },
                { status: 422 }
            );
        }

        const sections = (report.sections as unknown as ReportSection[]) ?? [];
        const targetSection = sections.find((s) => s.id === sectionId);

        if (!targetSection) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: `Section '${sectionId}' not found in this report.` } },
                { status: 404 }
            );
        }

        if (!AI_AVAILABLE) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'OpenRouter is not configured.',
                    },
                },
                { status: 503 }
            );
        }

        // Build section-specific regeneration prompt
        const sectionPrompt = [
            `Regenerate only the section titled "${targetSection.title}" for a ${report.templateType} mortgage suitability report.`,
            `Client: ${JSON.stringify(report.case.client)}.`,
            `Case: caseId=${report.caseId}, type=${report.case.type}.`,
            adviserContext ? `Adviser context: ${adviserContext}.` : '',
            'Return ONLY valid JSON: { "sections": [{ "id": string, "title": string, "content": string, "complianceFlag": "OK" | "REVIEW_REQUIRED", "flagReason": string | null }] }',
        ]
            .filter(Boolean)
            .join('\n');

        const rawResponse = await callOpenRouter([
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: sectionPrompt },
        ]);

        const parsed = JSON.parse(rawResponse);
        const regeneratedSection: ReportSection = {
            ...(parsed.sections?.[0] ?? targetSection),
            id: sectionId,
            complianceFlag: 'REVIEW_REQUIRED' as const,
            flagReason: 'Regenerated — requires adviser review before finalisation.',
        };

        // Replace only the target section; preserve all others
        const updatedSections = sections.map((s) =>
            s.id === sectionId ? regeneratedSection : s
        );

        const updatedReport = await prisma.suitabilityReport.update({
            where: { id: reportId },
            data: {
                sections: updatedSections as unknown as Prisma.InputJsonValue,
                status: report.status === 'APPROVED' ? 'ADVISER_REVIEW' : report.status,
                updatedAt: new Date(),
            },
        });

        await logAuditEvent({
            orgId: orgId!,
            userId: user?.id,
            entityType: 'SuitabilityReport',
            entityId: reportId,
            action: 'REPORT_SECTION_REGENERATED',
            diff: { sectionId, sectionTitle: targetSection.title },
        });

        return NextResponse.json({ success: true, data: updatedReport }, { status: 200 });
    },
});
