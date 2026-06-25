import type { ClientType, EmploymentStatus } from '@ko/types';

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
  isVulnerable: boolean;
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
    isVulnerable: client.isVulnerable,
    _count: client._count,
  };
}
