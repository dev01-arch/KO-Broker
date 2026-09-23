import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError, isPrismaUniqueConflict } from '@/lib/api/prisma-errors';
import { validateStageTransition } from '@/lib/api/stage-transition';
import { calculateLTV, generateReference } from '@ko/utils';
import type { CaseStage, CaseType, UpsertFactFindInput } from '@ko/types';
import { caseAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';
import { checkAndSetRecommendationStale } from '@/lib/compliance/stale';

function shouldUseDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

async function nextCaseReferenceSequence(orgId: string): Promise<number> {
  const year = new Date().getFullYear();
  const prefix = `KOF-${year}-`;
  const latest = await prisma.case.findFirst({
    where: { orgId, referenceNumber: { startsWith: prefix } },
    orderBy: { referenceNumber: 'desc' },
    select: { referenceNumber: true },
  });
  if (!latest?.referenceNumber) return 1;
  const parsed = Number.parseInt(latest.referenceNumber.slice(prefix.length), 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
}

const caseListSelect = {
  id: true,
  referenceNumber: true,
  clientId: true,
  type: true,
  stage: true,
  propertyValue: true,
  loanAmount: true,
  ltv: true,
  termYears: true,
  selectedLender: true,
  selectedProduct: true,
  updatedAt: true,
  // PRD-16 W6: date fields for radar filtering
  offerExpiresAt: true,
  initialRateEndsAt: true,
  client: {
    select: {
      id: true,
      clientType: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  adviser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  _count: { select: { messages: true, documents: true } },
} as const;

export async function listCasesForOrg(
  orgId: string,
  params: {
    page: number;
    perPage: number;
    search?: string;
    stage?: CaseStage;
    type?: CaseType;
    clientId?: string;
    adviserId?: string;
    /** When set, only cases linked to this adviser (case or client assignment). */
    restrictToAdviserUserId?: string;
  },
) {
  try {
    const andFilters = [
      ...(params.restrictToAdviserUserId
        ? [caseAssignedToAdviserWhere(params.restrictToAdviserUserId)]
        : params.adviserId
          ? [{ assignedAdviserId: params.adviserId }]
          : []),
      ...(params.search
        ? [
            {
              OR: [
                { referenceNumber: { contains: params.search, mode: 'insensitive' as const } },
                { client: { companyName: { contains: params.search, mode: 'insensitive' as const } } },
                { client: { firstName: { contains: params.search, mode: 'insensitive' as const } } },
                { client: { lastName: { contains: params.search, mode: 'insensitive' as const } } },
                { client: { email: { contains: params.search, mode: 'insensitive' as const } } },
              ],
            },
          ]
        : []),
    ];

    const where = {
      orgId,
      ...(params.stage ? { stage: params.stage } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    };

    const [total, cases] = await Promise.all([
      prisma.case.count({ where }),
      prisma.case.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.perPage,
        take: params.perPage,
        select: caseListSelect,
      }),
    ]);

    return { total, cases };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.listCases(orgId, params);
  }
}

export async function createCaseForOrg(
  orgId: string,
  input: {
    clientId: string;
    type: CaseType;
    propertyValue?: number;
    loanAmount?: number;
    termYears?: number;
  },
) {
  const client = await (async () => {
    try {
      return await prisma.client.findFirst({
        where: { id: input.clientId, orgId },
        select: { id: true },
      });
    } catch (error) {
      if (!shouldUseDevStore(error)) throw error;
      return devStore.getClient(orgId, input.clientId) ?? null;
    }
  })();
  if (!client) return { error: 'NOT_FOUND' as const };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const referenceNumber = generateReference('KOF', await nextCaseReferenceSequence(orgId));
      const ltv =
        input.propertyValue && input.loanAmount
          ? calculateLTV(input.loanAmount, input.propertyValue)
          : undefined;

      const created = await prisma.case.create({
        data: {
          orgId,
          clientId: input.clientId,
          referenceNumber,
          type: input.type,
          propertyValue: input.propertyValue,
          loanAmount: input.loanAmount,
          ltv,
          termYears: input.termYears,
        },
        select: caseListSelect,
      });

      return { case: created };
    } catch (error) {
      if (isPrismaUniqueConflict(error, 'referenceNumber') && attempt < 2) continue;
      if (!shouldUseDevStore(error)) throw error;
      const result = devStore.createCase(orgId, input);
      if ('error' in result) return result;
      return { case: result.case };
    }
  }

  throw new Error('Failed to generate a unique case reference number');
}

export async function getCaseForOrg(orgId: string, id: string) {
  try {
    return await prisma.case.findFirst({
      where: { id, orgId },
      include: {
        client: {
          select: {
            id: true,
            referenceNumber: true,
            clientType: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            employmentStatus: true,
          },
        },
        adviser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        factFind: true,
        productsConsidered: { orderBy: { createdAt: 'asc' as const } },
        notes: {
          orderBy: { createdAt: 'asc' as const },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        // PRD-16 W5: outstanding document requests — badge count for compliance panel
        infoRequests: {
          where: { status: 'OUTSTANDING' },
          orderBy: { createdAt: 'desc' as const },
          select: {
            id: true,
            clientId: true,
            checklistItemId: true,
            documentType: true,
            messageId: true,
            status: true,
            fulfilledDocumentId: true,
            createdAt: true,
            fulfilledAt: true,
          },
        },
        property: {
          select: {
            id: true,
            postcode: true,
            address: true,
            type: true,
            currentValue: true,
          },
        },
        _count: { select: { messages: true, documents: true } },
      },
    });
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.getCase(orgId, id);
  }
}

export async function updateCaseForOrg(
  orgId: string,
  id: string,
  input: {
    stage?: CaseStage;
    propertyValue?: number;
    loanAmount?: number;
    termYears?: number;
    selectedLender?: string;
    selectedProduct?: string;
    selectedRate?: number;
    selectedFee?: number;
    adviserNotes?: string;
    assignedAdviserId?: string | null;
    // PRD-16: Property + Lender FK
    propertyId?: string | null;
    lenderId?: string | null;
    lenderOtherName?: string | null;
    // PRD-16: Date spine
    aipAt?: string | null;
    submittedAt?: string | null;
    offerIssuedAt?: string | null;
    offerExpiresAt?: string | null;
    exchangeAt?: string | null;
    completionAt?: string | null;
    // PRD-16: Account strip
    rateType?: string | null;
    monthlyPayment?: number | null;
    initialRateEndsAt?: string | null;
    chargeType?: string | null;
    isOffset?: boolean | null;
  },
  options?: { userId?: string },
) {
  try {
    // Snapshot qualifying fields BEFORE update so we can detect stale triggers
    const existing = await prisma.case.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        stage: true,
        propertyValue: true,
        loanAmount: true,
        termYears: true,
        propertyId: true,
      },
    });
    if (!existing) return { error: 'NOT_FOUND' as const };

    if (input.stage) {
      const violation = validateStageTransition(existing.stage, input.stage);
      if (violation) return { error: 'BUSINESS_RULE_VIOLATION' as const, message: violation };
    }

    if (input.assignedAdviserId) {
      const adviser = await prisma.user.findFirst({
        where: { id: input.assignedAdviserId, orgId },
        select: { id: true },
      });
      if (!adviser) return { error: 'NOT_FOUND' as const, message: 'Adviser not found' };
    }

    const propertyValue = input.propertyValue ?? existing.propertyValue ?? undefined;
    const loanAmount = input.loanAmount ?? existing.loanAmount ?? undefined;
    const ltv =
      propertyValue && loanAmount ? calculateLTV(loanAmount, propertyValue) : undefined;

    const toDate = (v?: string | null): Date | null | undefined => {
      if (v === null) return null;
      if (v === undefined) return undefined;
      return new Date(v);
    };

    const updated = await prisma.case.update({
      where: { id },
      data: {
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.propertyValue !== undefined ? { propertyValue: input.propertyValue } : {}),
        ...(input.loanAmount !== undefined ? { loanAmount: input.loanAmount } : {}),
        ...(input.termYears !== undefined ? { termYears: input.termYears } : {}),
        ...(input.selectedLender !== undefined ? { selectedLender: input.selectedLender } : {}),
        ...(input.selectedProduct !== undefined ? { selectedProduct: input.selectedProduct } : {}),
        ...(input.selectedRate !== undefined ? { selectedRate: input.selectedRate } : {}),
        ...(input.selectedFee !== undefined ? { selectedFee: input.selectedFee } : {}),
        ...(input.adviserNotes !== undefined ? { adviserNotes: input.adviserNotes } : {}),
        ...(input.assignedAdviserId !== undefined ? { assignedAdviserId: input.assignedAdviserId } : {}),
        ...(ltv !== undefined ? { ltv } : {}),
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.lenderId !== undefined ? { lenderId: input.lenderId } : {}),
        ...(input.lenderOtherName !== undefined ? { lenderOtherName: input.lenderOtherName } : {}),
        ...(input.aipAt !== undefined ? { aipAt: toDate(input.aipAt) } : {}),
        ...(input.submittedAt !== undefined ? { submittedAt: toDate(input.submittedAt) } : {}),
        ...(input.offerIssuedAt !== undefined ? { offerIssuedAt: toDate(input.offerIssuedAt) } : {}),
        ...(input.offerExpiresAt !== undefined ? { offerExpiresAt: toDate(input.offerExpiresAt) } : {}),
        ...(input.exchangeAt !== undefined ? { exchangeAt: toDate(input.exchangeAt) } : {}),
        ...(input.completionAt !== undefined ? { completionAt: toDate(input.completionAt) } : {}),
        ...(input.rateType !== undefined ? { rateType: input.rateType } : {}),
        ...(input.monthlyPayment !== undefined ? { monthlyPayment: input.monthlyPayment } : {}),
        ...(input.initialRateEndsAt !== undefined ? { initialRateEndsAt: toDate(input.initialRateEndsAt) } : {}),
        ...(input.chargeType !== undefined ? { chargeType: input.chargeType } : {}),
        ...(input.isOffset !== undefined ? { isOffset: input.isOffset } : {}),
      },
      select: caseListSelect,
    });

    // ── PRD-16 W4: stale detection ─────────────────────────────────────────
    // Detect which qualifying fields actually changed value
    const changedFields: string[] = [];
    if (input.loanAmount !== undefined && input.loanAmount !== existing.loanAmount) {
      changedFields.push('loanAmount');
    }
    if (input.propertyValue !== undefined && input.propertyValue !== existing.propertyValue) {
      changedFields.push('propertyValue');
    }
    if (input.termYears !== undefined && input.termYears !== existing.termYears) {
      changedFields.push('termYears');
    }
    if (input.propertyId !== undefined && input.propertyId !== existing.propertyId) {
      changedFields.push('propertyId');
    }

    if (changedFields.length > 0) {
      // Fire-and-forget — stale check reads from DB so runs after the update above
      void checkAndSetRecommendationStale({
        orgId,
        caseId: id,
        changedFields,
        reason: `Case financial details updated (${changedFields.join(', ')})`,
        userId: options?.userId,
      });
    }

    return { case: updated };
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.updateCase(orgId, id, input);
  }
}

export async function upsertFactFindForCase(
  orgId: string,
  caseId: string,
  input: UpsertFactFindInput,
) {
  const result = await import('@/lib/api/fact-find-data').then((m) =>
    m.upsertFactFindWithCompliance(orgId, caseId, input, { allowWhenComplete: true }),
  );
  if ('error' in result && result.error === 'FORBIDDEN') {
    return { error: 'NOT_FOUND' as const };
  }
  return result;
}
