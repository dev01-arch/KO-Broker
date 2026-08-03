import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError, isPrismaUniqueConflict } from '@/lib/api/prisma-errors';
import { validateStageTransition } from '@/lib/api/stage-transition';
import { calculateLTV, generateReference } from '@ko/utils';
import type { CaseStage, CaseType, UpsertFactFindInput } from '@ko/types';
import { caseAssignedToAdviserWhere } from '@/lib/auth/adviser-scope';

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
  },
) {
  try {
    const existing = await prisma.case.findFirst({
      where: { id, orgId },
      select: { id: true, stage: true, propertyValue: true, loanAmount: true },
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

    const updated = await prisma.case.update({
      where: { id },
      data: {
        ...input,
        ...(ltv !== undefined ? { ltv } : {}),
      },
      select: caseListSelect,
    });

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
