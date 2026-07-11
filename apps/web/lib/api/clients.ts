import type {
  ClientCategoryFilter,
  ClientStatus,
  ClientType,
  EmploymentStatus,
} from '@ko/types';

export function serializeClientSummary(client: {
  id: string;
  referenceNumber: string;
  clientType?: ClientType;
  companyName?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  employmentStatus: EmploymentStatus;
  annualIncome?: number | null;
  isReferred?: boolean;
  referredToCompany?: string | null;
  status?: ClientStatus;
  insurerName?: string | null;
  isVulnerable: boolean;
  assignedMember?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  _count: { cases: number; messages: number };
}) {
  return {
    id: client.id,
    referenceNumber: client.referenceNumber,
    clientType: client.clientType ?? 'INDIVIDUAL',
    companyName: client.companyName ?? undefined,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    employmentStatus: client.employmentStatus,
    annualIncome: client.annualIncome ?? undefined,
    isReferred: client.isReferred ?? false,
    referredToCompany: client.referredToCompany ?? undefined,
    status: client.status ?? 'PROSPECT',
    insurerName: client.insurerName ?? undefined,
    isVulnerable: client.isVulnerable,
    assignedMember: client.assignedMember
      ? {
          id: client.assignedMember.id,
          firstName: client.assignedMember.firstName,
          lastName: client.assignedMember.lastName,
        }
      : null,
    _count: client._count,
  };
}
