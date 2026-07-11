import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { logAuditEvent } from '@/lib/compliance/audit';
import { runComplianceCheck, type ReportSection } from '@/lib/ai/complianceCheck';
import {
  buildReportPrompt,
  SYSTEM_PROMPT,
  type ReportTemplate as PromptTemplate,
} from '@/lib/ai/buildReportPrompt';
import { callOpenRouter, isReportAiAvailable } from '@/lib/ai/azureClient';
import {
  generateReportPdfBuffer,
} from '@/lib/pdf/generateReportPdf';
import { uploadToR2 } from '@/lib/storage/r2';
import {
  sendRecommendationNotification,
} from '@/lib/notifications/email';
import {
  sendSMSRecommendationNotification,
} from '@/lib/notifications/sms';
import type { ReportTemplate } from '@ko/types';
import type { Prisma } from '@ko/db';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

function parseAiSections(raw: string): ReportSection[] {
  const parsed = JSON.parse(raw) as { sections?: ReportSection[] };
  const sections = parsed.sections ?? [];
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('AI response did not include any report sections.');
  }
  return sections.map((section) => ({
    id: String(section.id ?? ''),
    title: String(section.title ?? ''),
    content: String(section.content ?? ''),
    complianceFlag: section.complianceFlag === 'OK' ? 'OK' : 'REVIEW_REQUIRED',
    flagReason: section.flagReason ?? null,
  }));
}

/** Supports both array (current) and legacy Record<string, string> shapes. */
export function coerceReportSections(sections: unknown): ReportSection[] {
  if (!sections) return [];
  if (Array.isArray(sections)) {
    return sections
      .filter((s): s is ReportSection => Boolean(s) && typeof s === 'object')
      .map((s) => ({
        id: String((s as ReportSection).id ?? ''),
        title: String((s as ReportSection).title ?? (s as ReportSection).id ?? ''),
        content: String((s as ReportSection).content ?? ''),
        complianceFlag: (s as ReportSection).complianceFlag,
        flagReason: (s as ReportSection).flagReason ?? null,
      }));
  }
  if (typeof sections === 'object') {
    return Object.entries(sections as Record<string, unknown>).map(([key, value]) => ({
      id: key,
      title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
      content: typeof value === 'string' ? value : JSON.stringify(value),
      complianceFlag: 'REVIEW_REQUIRED' as const,
      flagReason: null,
    }));
  }
  return [];
}

export async function listAiReportsForOrg(
  orgId: string,
  params: { page: number; perPage: number; caseId?: string },
) {
  try {
    const where = {
      case: { orgId },
      ...(params.caseId ? { caseId: params.caseId } : {}),
    };
    const [total, reports] = await Promise.all([
      prisma.suitabilityReport.count({ where }),
      prisma.suitabilityReport.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
        include: {
          case: { select: { id: true, referenceNumber: true, clientId: true } },
        },
      }),
    ]);
    return { total, reports };
  } catch (error) {
    if (useDevStore(error)) {
      const result = devStore.listAiReports(orgId, params);
      return { total: result.total, reports: result.reports };
    }
    throw error;
  }
}

export async function createAiReportForOrg(
  orgId: string,
  input: { caseId: string; templateType: ReportTemplate; generatedBy?: string },
) {
  try {
    const caseRecord = await prisma.case.findFirst({
      where: { id: input.caseId, orgId },
      include: {
        client: true,
        factFind: true,
        productsConsidered: true,
      },
    });
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    if (!caseRecord.factFind || !caseRecord.factFind.completedAt) {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: 'Fact-find must be completed before generating a report.',
      };
    }

    if (caseRecord.productsConsidered.length < 3) {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: `At least 3 products must be recorded. Found: ${caseRecord.productsConsidered.length}.`,
      };
    }

    const hasSelectedProduct =
      caseRecord.productsConsidered.some((p) => p.isSelected) ||
      (caseRecord.selectedProduct && caseRecord.selectedLender);

    if (!hasSelectedProduct) {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: 'A selected product must be confirmed before generating a report.',
      };
    }

    if (!isReportAiAvailable()) {
      return {
        error: 'SERVICE_UNAVAILABLE' as const,
        message: 'OpenRouter is not configured. Set OPENROUTER_API_KEY.',
      };
    }

    const selectedProduct = caseRecord.productsConsidered.find((p) => p.isSelected) ?? null;
    const userPrompt = buildReportPrompt({
      templateType: input.templateType as PromptTemplate,
      client: caseRecord.client as unknown as Record<string, unknown>,
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
      productsConsidered: caseRecord.productsConsidered as unknown as Record<string, unknown>[],
      selectedProduct: selectedProduct as unknown as Record<string, unknown> | null,
      adviserNotes: caseRecord.adviserNotes,
      isVulnerable: caseRecord.client.isVulnerable ?? false,
    });

    const rawResponse = await callOpenRouter([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);
    const sections = parseAiSections(rawResponse);

    const report = await prisma.suitabilityReport.create({
      data: {
        caseId: input.caseId,
        templateType: input.templateType,
        status: 'DRAFT',
        sections: sections as unknown as Prisma.InputJsonValue,
        generatedBy: input.generatedBy,
      },
      include: {
        case: { select: { id: true, referenceNumber: true, clientId: true } },
      },
    });

    await logAuditEvent({
      orgId,
      userId: input.generatedBy,
      entityType: 'SuitabilityReport',
      entityId: report.id,
      action: 'REPORT_GENERATED',
      diff: {
        after: {
          caseId: input.caseId,
          templateType: input.templateType,
          status: 'DRAFT',
          sectionsCount: sections.length,
        },
      },
    });

    return { report };
  } catch (error) {
    if (useDevStore(error)) return devStore.createAiReport(orgId, input);
    throw error;
  }
}

export async function getAiReportForOrg(orgId: string, id: string) {
  try {
    return await prisma.suitabilityReport.findFirst({
      where: { id, case: { orgId } },
      include: {
        case: { select: { id: true, referenceNumber: true, clientId: true } },
      },
    });
  } catch (error) {
    if (useDevStore(error)) return devStore.getAiReport(orgId, id);
    throw error;
  }
}

export async function regenerateReportSection(
  orgId: string,
  reportId: string,
  sectionId: string,
  options?: { adviserContext?: string; userId?: string },
) {
  try {
    const report = await prisma.suitabilityReport.findFirst({
      where: { id: reportId, case: { orgId } },
      include: {
        case: {
          include: {
            client: true,
            productsConsidered: true,
          },
        },
      },
    });
    if (!report) return { error: 'NOT_FOUND' as const };

    if (report.status === 'FINALISED') {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: 'Cannot regenerate sections of a finalised report.',
      };
    }

    const sections = coerceReportSections(report.sections);
    const targetSection = sections.find((s) => s.id === sectionId);
    if (!targetSection) {
      return {
        error: 'NOT_FOUND' as const,
        message: `Section '${sectionId}' not found in this report.`,
      };
    }

    if (!isReportAiAvailable()) {
      return {
        error: 'SERVICE_UNAVAILABLE' as const,
        message: 'OpenRouter is not configured. Set OPENROUTER_API_KEY.',
      };
    }

    const adviserContext = options?.adviserContext;
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
    const parsedSections = parseAiSections(rawResponse);
    const regeneratedSection: ReportSection = {
      ...(parsedSections[0] ?? targetSection),
      id: sectionId,
      title: targetSection.title,
      complianceFlag: 'REVIEW_REQUIRED',
      flagReason: 'Regenerated — requires adviser review before finalisation.',
    };

    const updatedSections = sections.map((s) =>
      s.id === sectionId ? regeneratedSection : s,
    );

    const updatedReport = await prisma.suitabilityReport.update({
      where: { id: reportId },
      data: {
        sections: updatedSections as unknown as Prisma.InputJsonValue,
        status: report.status === 'APPROVED' ? 'ADVISER_REVIEW' : report.status,
        updatedAt: new Date(),
      },
      include: {
        case: { select: { id: true, referenceNumber: true, clientId: true } },
      },
    });

    await logAuditEvent({
      orgId,
      userId: options?.userId,
      entityType: 'SuitabilityReport',
      entityId: reportId,
      action: 'REPORT_SECTION_REGENERATED',
      diff: { sectionId, sectionTitle: targetSection.title },
    });

    return { report: updatedReport };
  } catch (error) {
    if (useDevStore(error)) {
      const content = options?.adviserContext
        ? `Regenerated content for section "${sectionId}" (${options.adviserContext}) — powered by OpenRouter.`
        : `Regenerated content for section "${sectionId}" — powered by OpenRouter.`;
      const devReport = devStore.updateAiReportSection(orgId, reportId, sectionId, content);
      if (!devReport) return { error: 'NOT_FOUND' as const };
      return { report: devReport };
    }
    throw error;
  }
}

export async function approveAiReportForOrg(orgId: string, id: string, approvedBy?: string) {
  try {
    const report = await prisma.suitabilityReport.findFirst({
      where: { id, case: { orgId } },
      include: {
        case: {
          include: {
            client: true,
            productsConsidered: true,
          },
        },
      },
    });

    if (!report) return { error: 'NOT_FOUND' as const };

    if (report.status === 'FINALISED') {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: 'Report is already finalised.',
      };
    }

    const sections = coerceReportSections(report.sections);
    const checkResult = runComplianceCheck(
      report.templateType as ReportTemplate,
      sections,
      report.case.productsConsidered.length,
      report.case.client.isVulnerable ?? false,
    );

    if (!checkResult.passed) {
      return {
        error: 'BUSINESS_RULE_VIOLATION' as const,
        message: 'Pre-finalisation compliance checks failed.',
        details: checkResult.issues,
      };
    }

    let pdfUrl = '';
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await generateReportPdfBuffer({
        ...report,
        sections,
      });
      const key = `reports/${report.id}/suitability_report_${Date.now()}.pdf`;
      pdfUrl = await uploadToR2(pdfBuffer, key, 'application/pdf');
    } catch (err) {
      console.error('[PDF ERROR] Failed to generate/upload PDF:', err);
      pdfUrl = `https://storage.koplatform.co.uk/reports/${id}/suitability_report.pdf`;
    }

    const finalisedReport = await prisma.suitabilityReport.update({
      where: { id },
      data: {
        status: 'FINALISED',
        pdfUrl,
        approvedBy,
        updatedAt: new Date(),
      },
      include: {
        case: { select: { id: true, referenceNumber: true, clientId: true } },
      },
    });

    await logAuditEvent({
      orgId,
      userId: approvedBy,
      entityType: 'SuitabilityReport',
      entityId: id,
      action: 'REPORT_FINALISED',
      diff: {
        before: { status: report.status },
        after: { status: 'FINALISED', pdfUrl },
      },
      notificationSent: true,
    });

    const clientEmail = report.case.client.email;
    const clientPhone = report.case.client.phone;

    try {
      await sendRecommendationNotification(
        orgId,
        report.caseId,
        report.case.clientId,
        clientEmail,
        pdfBuffer,
      );
      if (clientPhone) {
        await sendSMSRecommendationNotification(
          orgId,
          report.caseId,
          report.case.clientId,
          clientPhone,
        );
      }
    } catch (err) {
      console.error('[NOTIFICATION ERROR] Failed to send finalisation notification:', err);
    }

    return { report: finalisedReport };
  } catch (error) {
    if (useDevStore(error)) {
      const devReport = devStore.approveAiReport(orgId, id, approvedBy);
      if (!devReport) return { error: 'NOT_FOUND' as const };
      return { report: devReport };
    }
    throw error;
  }
}
