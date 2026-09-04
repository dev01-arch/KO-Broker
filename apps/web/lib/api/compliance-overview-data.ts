import { prisma } from '@/lib/db';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { logAuditEvent } from '@/lib/compliance/audit';
import { caseAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';
import {
  buildComplianceOverview,
  checklistRecordStage,
  evaluateCaseCompliance,
  isComplianceItemId,
  type ChecklistCaseInput,
  type ComplianceItemId,
  type CaseComplianceSnapshot,
  type ComplianceOverviewPayload,
} from '@/lib/compliance/checklist';
import type { CaseStage, CaseType } from '@ko/types';

const caseComplianceInclude = {
  client: {
    select: {
      firstName: true,
      lastName: true,
      companyName: true,
      clientType: true,
      referenceNumber: true,
      isVulnerable: true,
      portalEnabled: true,
      vulnerabilityNotes: true,
    },
  },
  adviser: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  factFind: {
    select: {
      completedAt: true,
      existingMortgages: true,
      clientPreferences: true,
    },
  },
  productsConsidered: {
    select: { isSelected: true },
  },
  documents: {
    select: {
      name: true,
      documentType: true,
      createdAt: true,
      caseId: true,
    },
  },
  complianceRecords: {
    select: {
      stage: true,
      completedAt: true,
      isApproved: true,
    },
  },
  suitabilityReports: {
    select: { status: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' as const },
    take: 1,
  },
} as const;

type LoadedCase = {
  id: string;
  referenceNumber: string;
  type: CaseType;
  stage: CaseStage;
  createdAt: Date;
  updatedAt: Date;
  adviserNotes: string | null;
  selectedProduct: string | null;
  selectedLender: string | null;
  client: ChecklistCaseInput['client'];
  adviser: ChecklistCaseInput['adviser'];
  factFind: ChecklistCaseInput['factFind'];
  productsConsidered: Array<{ isSelected: boolean }>;
  documents: ChecklistCaseInput['documents'];
  complianceRecords: ChecklistCaseInput['complianceRecords'];
  suitabilityReports: ChecklistCaseInput['suitabilityReports'];
};

function toChecklistInput(row: LoadedCase): ChecklistCaseInput {
  return {
    id: row.id,
    referenceNumber: row.referenceNumber,
    type: row.type,
    stage: row.stage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    adviserNotes: row.adviserNotes,
    selectedProduct: row.selectedProduct,
    selectedLender: row.selectedLender,
    client: row.client,
    adviser: row.adviser,
    factFind: row.factFind,
    productsConsidered: row.productsConsidered,
    documents: row.documents,
    complianceRecords: row.complianceRecords,
    suitabilityReports: row.suitabilityReports,
  };
}

function emptyOverview(): ComplianceOverviewPayload {
  return buildComplianceOverview([], []);
}

export async function getComplianceOverviewForOrg(
  orgId: string,
  options?: { restrictToAdviserUserId?: string },
): Promise<ComplianceOverviewPayload> {
  try {
    const where = {
      orgId,
      ...(options?.restrictToAdviserUserId
        ? caseAssignedToAdviserWhere(options.restrictToAdviserUserId)
        : {}),
    };

    const [cases, firmDocs] = await Promise.all([
      prisma.case.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: caseComplianceInclude,
      }),
      prisma.document.findMany({
        where: { orgId, documentType: 'COMPLIANCE', caseId: null },
        select: { name: true, documentType: true, createdAt: true, caseId: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return buildComplianceOverview(cases.map((row) => toChecklistInput(row as LoadedCase)), firmDocs);
  } catch (error) {
    if (process.env.NODE_ENV === 'development' && isPrismaConnectionError(error)) {
      return emptyOverview();
    }
    throw error;
  }
}

export async function getCaseComplianceForOrg(
  orgId: string,
  caseId: string,
  options?: { restrictToAdviserUserId?: string },
): Promise<CaseComplianceSnapshot | { error: 'NOT_FOUND' }> {
  try {
    const row = await prisma.case.findFirst({
      where: {
        id: caseId,
        orgId,
        ...(options?.restrictToAdviserUserId
          ? caseAssignedToAdviserWhere(options.restrictToAdviserUserId)
          : {}),
      },
      include: caseComplianceInclude,
    });
    if (!row) return { error: 'NOT_FOUND' };
    return evaluateCaseCompliance(toChecklistInput(row as LoadedCase));
  } catch (error) {
    if (process.env.NODE_ENV === 'development' && isPrismaConnectionError(error)) {
      return { error: 'NOT_FOUND' };
    }
    throw error;
  }
}

export async function completeComplianceItemForOrg(
  orgId: string,
  caseId: string,
  itemId: string,
  userId?: string,
  options?: { restrictToAdviserUserId?: string },
): Promise<CaseComplianceSnapshot | { error: 'NOT_FOUND' | 'VALIDATION_ERROR'; message?: string }> {
  if (!isComplianceItemId(itemId)) {
    return { error: 'VALIDATION_ERROR', message: 'Unknown compliance checklist item.' };
  }

  const existing = await getCaseComplianceForOrg(orgId, caseId, options);
  if ('error' in existing) return existing;

  const stage = checklistRecordStage(itemId as ComplianceItemId);

  try {
    const already = await prisma.complianceRecord.findFirst({
      where: { caseId, stage },
      select: { id: true },
    });
    if (!already) {
      await prisma.complianceRecord.create({
        data: {
          caseId,
          stage,
          completedAt: new Date(),
          isApproved: true,
          userId: userId ?? null,
        },
      });
      await logAuditEvent({
        orgId,
        userId,
        entityType: 'Case',
        entityId: caseId,
        action: 'COMPLIANCE_ITEM_COMPLETED',
        diff: { itemId },
      });
    }

    const refreshed = await getCaseComplianceForOrg(orgId, caseId, options);
    if ('error' in refreshed) return refreshed;
    return refreshed;
  } catch (error) {
    if (process.env.NODE_ENV === 'development' && isPrismaConnectionError(error)) {
      return existing;
    }
    throw error;
  }
}
