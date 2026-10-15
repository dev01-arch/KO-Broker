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
  phone?: string | null;
  dateOfBirth?: Date | string | null;
  niNumber?: string | null;
  address?: unknown;
  properties?: Array<{
    id: string;
    postcode: string;
    address?: unknown;
    currentValue?: number | null;
  }>;
  assignedMember?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  _count: { cases: number; messages: number };
}) {
  const dateOfBirth = toDateOnly(client.dateOfBirth);
  const address =
    client.address && typeof client.address === 'object' && !Array.isArray(client.address)
      ? (client.address as Record<string, unknown>)
      : undefined;
  const properties = (client.properties ?? []).map((home) => ({
    id: home.id,
    postcode: home.postcode,
    address:
      home.address && typeof home.address === 'object' && !Array.isArray(home.address)
        ? (home.address as Record<string, unknown>)
        : undefined,
    currentValue: home.currentValue ?? undefined,
  }));

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
    phone: client.phone ?? undefined,
    dateOfBirth,
    niNumber: client.niNumber ?? undefined,
    address,
    properties,
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

function toDateOnly(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : undefined;
}
