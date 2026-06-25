import type { ClientType, EmploymentStatus } from '@ko/types';

export type ClientNameFields = {
  clientType?: ClientType;
  firstName: string;
  lastName: string;
  companyName?: string | null;
};

const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  EMPLOYED: 'Employed',
  SELF_EMPLOYED: 'Self Employed',
  CONTRACTOR: 'Contractor',
  RETIRED: 'Retired',
  UNEMPLOYED: 'Unemployed',
};

export function formatClientName(client: ClientNameFields): string {
  if (client.clientType === 'COMPANY') {
    return client.companyName?.trim() || client.firstName;
  }
  return `${client.firstName} ${client.lastName}`.trim();
}

export function formatClientInitials(client: ClientNameFields): string {
  if (client.clientType === 'COMPANY') {
    const name = client.companyName?.trim() || client.firstName;
    return name.slice(0, 2).toUpperCase();
  }
  return `${client.firstName[0] ?? ''}${client.lastName[0] ?? ''}`.toUpperCase();
}

export function formatClientEmployment(
  client: Pick<ClientNameFields, 'clientType'> & { employmentStatus: EmploymentStatus },
): string {
  if (client.clientType === 'COMPANY') {
    return 'Limited Company';
  }
  return EMPLOYMENT_LABELS[client.employmentStatus] ?? client.employmentStatus;
}
