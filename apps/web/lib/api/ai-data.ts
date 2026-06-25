import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import type { ReportTemplate } from '@ko/types';

function useDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
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
    const caseRecord = await prisma.case.findFirst({ where: { id: input.caseId, orgId } });
    if (!caseRecord) return { error: 'NOT_FOUND' as const };

    const sections = {
      clientIntroduction:
        'Client objectives, income, and risk profile documented during the digital fact-find.',
      propertyDetails:
        'Subject property details, valuation, and loan-to-value documented for this case.',
      ercAnalysis:
        'Early repayment charge tiers modelled across the recommended product term.',
      consumerDuty:
        'Consumer Duty risks communicated; fair value assessment and personalised outcomes recorded.',
    };

    const report = await prisma.suitabilityReport.create({
      data: {
        caseId: input.caseId,
        templateType: input.templateType,
        status: 'DRAFT',
        sections,
        generatedBy: input.generatedBy,
      },
      include: {
        case: { select: { id: true, referenceNumber: true, clientId: true } },
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
  sectionKey: string,
  content: string,
) {
  try {
    const existing = await prisma.suitabilityReport.findFirst({
      where: { id: reportId, case: { orgId } },
    });
    if (!existing) return null;
    const currentSections = (existing.sections as Record<string, unknown>) ?? {};
    return await prisma.suitabilityReport.update({
      where: { id: reportId },
      data: {
        sections: { ...currentSections, [sectionKey]: content } as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    if (useDevStore(error))
      return devStore.updateAiReportSection(orgId, reportId, sectionKey, content);
    throw error;
  }
}

export async function approveAiReportForOrg(orgId: string, id: string, approvedBy?: string) {
  try {
    const existing = await prisma.suitabilityReport.findFirst({
      where: { id, case: { orgId } },
    });
    if (!existing) return null;
    return await prisma.suitabilityReport.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy, updatedAt: new Date() },
    });
  } catch (error) {
    if (useDevStore(error)) return devStore.approveAiReport(orgId, id, approvedBy);
    throw error;
  }
}
