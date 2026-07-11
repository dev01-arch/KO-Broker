import type { CaseStage, CaseType, ClientType } from '@ko/types';

type CaseClient = {
  id: string;
  clientType?: ClientType;
  companyName?: string | null;
  firstName: string;
  lastName: string;
  email: string;
};

type CaseAdviser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

export function serializeCaseSummary(caseRecord: {
  id: string;
  referenceNumber: string;
  clientId: string;
  type: CaseType;
  stage: CaseStage;
  propertyValue?: number | null;
  loanAmount?: number | null;
  ltv?: number | null;
  termYears?: number | null;
  selectedLender?: string | null;
  selectedProduct?: string | null;
  updatedAt: Date;
  client: CaseClient;
  adviser?: CaseAdviser | null;
  _count: { messages: number; documents: number };
}) {
  return {
    id: caseRecord.id,
    referenceNumber: caseRecord.referenceNumber,
    clientId: caseRecord.clientId,
    client: caseRecord.client,
    type: caseRecord.type,
    stage: caseRecord.stage,
    propertyValue: caseRecord.propertyValue ?? undefined,
    loanAmount: caseRecord.loanAmount ?? undefined,
    ltv: caseRecord.ltv ?? undefined,
    termYears: caseRecord.termYears ?? undefined,
    selectedLender: caseRecord.selectedLender ?? undefined,
    selectedProduct: caseRecord.selectedProduct ?? undefined,
    adviser: caseRecord.adviser
      ? {
          id: caseRecord.adviser.id,
          firstName: caseRecord.adviser.firstName,
          lastName: caseRecord.adviser.lastName,
        }
      : null,
    updatedAt: caseRecord.updatedAt.toISOString(),
    _count: caseRecord._count,
  };
}

export function serializeCaseDetail(caseRecord: {
  id: string;
  referenceNumber: string;
  clientId: string;
  type: CaseType;
  stage: CaseStage;
  propertyValue?: number | null;
  loanAmount?: number | null;
  ltv?: number | null;
  termYears?: number | null;
  selectedLender?: string | null;
  selectedProduct?: string | null;
  selectedRate?: number | null;
  selectedFee?: number | null;
  adviserNotes?: string | null;
  assignedAdviserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: CaseClient & {
    referenceNumber: string;
    phone?: string | null;
    employmentStatus: string;
    clientType?: ClientType;
    companyName?: string | null;
  };
  adviser?: CaseAdviser | null;
  factFind?: {
    id: string;
    personalDetails?: unknown;
    employmentDetails?: unknown;
    incomeDetails?: unknown;
    expenditureDetails?: unknown;
    propertyDetails?: unknown;
    existingMortgages?: unknown;
    clientPreferences?: unknown;
    completedAt?: Date | null;
    updatedAt: Date;
  } | null;
  productsConsidered?: Array<{
    id: string;
    caseId: string;
    lenderName: string;
    productName: string;
    rate?: number | null;
    fee?: number | null;
    isSelected: boolean;
    reasonNotSelected?: string | null;
    createdAt: Date;
  }>;
  _count: { messages: number; documents: number };
}) {
  return {
    ...serializeCaseSummary({
      ...caseRecord,
      client: {
        id: caseRecord.client.id,
        clientType: caseRecord.client.clientType,
        companyName: caseRecord.client.companyName ?? undefined,
        firstName: caseRecord.client.firstName,
        lastName: caseRecord.client.lastName,
        email: caseRecord.client.email,
      },
      _count: {
        messages: caseRecord._count.messages,
        documents: caseRecord._count.documents,
      },
    }),
    selectedRate: caseRecord.selectedRate ?? undefined,
    selectedFee: caseRecord.selectedFee ?? undefined,
    adviserNotes: caseRecord.adviserNotes ?? undefined,
    assignedAdviserId: caseRecord.assignedAdviserId ?? undefined,
    createdAt: caseRecord.createdAt.toISOString(),
    client: {
      id: caseRecord.client.id,
      referenceNumber: caseRecord.client.referenceNumber,
      clientType: caseRecord.client.clientType,
      companyName: caseRecord.client.companyName ?? undefined,
      firstName: caseRecord.client.firstName,
      lastName: caseRecord.client.lastName,
      email: caseRecord.client.email,
      phone: caseRecord.client.phone ?? undefined,
      employmentStatus: caseRecord.client.employmentStatus,
    },
    factFind: caseRecord.factFind
      ? {
          id: caseRecord.factFind.id,
          personalDetails: caseRecord.factFind.personalDetails ?? undefined,
          employmentDetails: caseRecord.factFind.employmentDetails ?? undefined,
          incomeDetails: caseRecord.factFind.incomeDetails ?? undefined,
          expenditureDetails: caseRecord.factFind.expenditureDetails ?? undefined,
          propertyDetails: caseRecord.factFind.propertyDetails ?? undefined,
          existingMortgages: caseRecord.factFind.existingMortgages ?? undefined,
          clientPreferences: caseRecord.factFind.clientPreferences ?? undefined,
          completedAt: caseRecord.factFind.completedAt?.toISOString() ?? undefined,
          updatedAt: caseRecord.factFind.updatedAt.toISOString(),
        }
      : null,
    productsConsidered: (caseRecord.productsConsidered ?? []).map((p) => ({
      id: p.id,
      caseId: p.caseId,
      lenderName: p.lenderName,
      productName: p.productName,
      rate: p.rate ?? undefined,
      fee: p.fee ?? undefined,
      isSelected: p.isSelected,
      reasonNotSelected: p.reasonNotSelected ?? undefined,
      createdAt: p.createdAt.toISOString(),
    })),
    _count: caseRecord._count,
  };
}

export function serializeFactFind(factFind: {
  id: string;
  caseId: string;
  personalDetails?: unknown;
  employmentDetails?: unknown;
  incomeDetails?: unknown;
  expenditureDetails?: unknown;
  propertyDetails?: unknown;
  existingMortgages?: unknown;
  clientPreferences?: unknown;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: factFind.id,
    caseId: factFind.caseId,
    personalDetails: factFind.personalDetails ?? undefined,
    employmentDetails: factFind.employmentDetails ?? undefined,
    incomeDetails: factFind.incomeDetails ?? undefined,
    expenditureDetails: factFind.expenditureDetails ?? undefined,
    propertyDetails: factFind.propertyDetails ?? undefined,
    existingMortgages: factFind.existingMortgages ?? undefined,
    clientPreferences: factFind.clientPreferences ?? undefined,
    completedAt: factFind.completedAt?.toISOString() ?? undefined,
    createdAt: factFind.createdAt.toISOString(),
    updatedAt: factFind.updatedAt.toISOString(),
  };
}
