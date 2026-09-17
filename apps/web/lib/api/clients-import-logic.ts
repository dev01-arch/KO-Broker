/**
 * Prisma-free import helpers so unit tests can run without the Next/DB graph.
 */

import {
  CLIENT_IMPORT_HARD_MAX_ROWS,
  CLIENT_IMPORT_TEMPLATE_EXAMPLE_ROW,
  CLIENT_IMPORT_TEMPLATE_HEADERS,
  ClientTypeSchema,
  EmploymentStatusSchema,
  type ClientType,
  type EmploymentStatus,
  type ImportClientRow,
  type ImportClientRowResult,
  type ImportClientsResult,
} from '@ko/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMPORT_CHUNK_SIZE = 50;

export type ImportClientsError = { error: 'TOO_LARGE' } | { error: 'EMPTY' };

export type ImportClientsRequest = {
  fileName?: string;
  sendWelcomeEmails?: boolean;
  duplicateEmail?: 'skip';
  rows: ImportClientRow[];
};

export type ImportMemberRef = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type ImportCreateClientInput = {
  clientType?: ClientType;
  title?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyNumber?: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  employmentStatus?: EmploymentStatus;
  annualIncome?: number;
  isReferred?: boolean;
  referredToCompany?: string;
  assignedMemberId?: string;
  insurerName?: string;
};

export type ImportCreateClientResult =
  | {
      client: {
        id: string;
        referenceNumber: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }
  | { error: 'VALIDATION'; fields: Record<string, string> };

export type ImportClientsDeps = {
  listExistingEmails: (orgId: string) => Promise<string[]>;
  findMemberByEmail: (orgId: string, email: string) => Promise<ImportMemberRef | null>;
  createClient: (
    orgId: string,
    input: ImportCreateClientInput,
    options?: { skipEmails?: boolean },
  ) => Promise<ImportCreateClientResult>;
  logAudit: (input: {
    orgId: string;
    userId?: string;
    entityType: string;
    entityId: string;
    action: string;
    diff?: unknown;
  }) => Promise<void>;
};

function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseImportDateOfBirth(
  raw: string,
): { iso: string } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: 'Date of birth is required' };

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidYmd(year, month, day)) return { error: 'Invalid date of birth' };
    return { iso: value };
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) {
    return { error: 'Use ISO (YYYY-MM-DD) or DD/MM/YYYY' };
  }

  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (uk) {
    const day = Number(uk[1]);
    const month = Number(uk[2]);
    const year = Number(uk[3]);
    if (!isValidYmd(year, month, day)) return { error: 'Invalid date of birth' };
    return {
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  return { error: 'Use ISO (YYYY-MM-DD) or DD/MM/YYYY' };
}

export function parseImportEmploymentStatus(
  raw: string | undefined,
): { value?: EmploymentStatus } | { error: string } {
  if (!raw?.trim()) return { value: undefined };
  const normalised = raw.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const mapped: Record<string, EmploymentStatus> = {
    employed: 'EMPLOYED',
    'self employed': 'SELF_EMPLOYED',
    selfemployed: 'SELF_EMPLOYED',
    contractor: 'CONTRACTOR',
    retired: 'RETIRED',
    unemployed: 'UNEMPLOYED',
  };
  const fromEnum = EmploymentStatusSchema.safeParse(raw.trim().toUpperCase().replace(/[\s-]+/g, '_'));
  if (fromEnum.success) return { value: fromEnum.data };
  const aliased = mapped[normalised];
  if (aliased) return { value: aliased };
  return { error: 'Unknown employment status' };
}

export function parseImportClientType(
  raw: string | undefined,
  companyName?: string,
  companyNumber?: string,
): { value: ClientType } | { error: string } {
  if (raw?.trim()) {
    const normalised = raw.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const fromEnum = ClientTypeSchema.safeParse(raw.trim().toUpperCase());
    if (fromEnum.success) return { value: fromEnum.data };
    if (normalised === 'company' || normalised === 'limited' || normalised === 'ltd') {
      return { value: 'COMPANY' };
    }
    if (normalised === 'individual' || normalised === 'person') {
      return { value: 'INDIVIDUAL' };
    }
    return { error: 'Unknown client type' };
  }
  if (companyName?.trim() && companyNumber?.trim()) return { value: 'COMPANY' };
  return { value: 'INDIVIDUAL' };
}

export function parseImportAnnualIncome(
  raw: number | string | undefined,
): { value?: number } | { error: string } {
  if (raw === undefined || raw === '') return { value: undefined };
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return { error: 'Invalid annual income' };
    return { value: raw };
  }
  const stripped = raw.replace(/[£,\s]/g, '');
  if (!stripped) return { value: undefined };
  const parsed = Number(stripped);
  if (!Number.isFinite(parsed) || parsed <= 0) return { error: 'Invalid annual income' };
  return { value: parsed };
}

export function isValidImportEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export type PreparedImportRow =
  | {
      ok: true;
      rowNumber: number;
      email: string;
      emailKey: string;
      input: ImportCreateClientInput;
      assignedAdviserEmail?: string;
    }
  | { ok: false; rowNumber: number; fields: Record<string, string> };

export function prepareImportRow(row: ImportClientRow): PreparedImportRow {
  const fields: Record<string, string> = {};
  const email = row.email.trim();
  if (!email) {
    fields.email = 'Email is required';
  } else if (!isValidImportEmail(email)) {
    fields.email = 'Valid email is required';
  }

  const income = parseImportAnnualIncome(row.annualIncome);
  if ('error' in income) fields.annualIncome = income.error;

  const employment = parseImportEmploymentStatus(row.employmentStatus);
  if ('error' in employment) fields.employmentStatus = employment.error;

  const clientType = parseImportClientType(row.clientType, row.companyName, row.companyNumber);
  if ('error' in clientType) {
    fields.clientType = clientType.error;
    return { ok: false, rowNumber: row.rowNumber, fields };
  }

  if (row.dateOfBirth?.trim()) {
    const dob = parseImportDateOfBirth(row.dateOfBirth);
    if ('error' in dob) fields.dateOfBirth = dob.error;
  }

  if (clientType.value === 'COMPANY') {
    if (!row.companyName?.trim()) fields.companyName = 'Company name is required';
    if (!row.companyNumber?.trim()) fields.companyNumber = 'Company registration number is required';
  } else {
    if (!row.firstName?.trim()) fields.firstName = 'First name is required';
    if (!row.lastName?.trim()) fields.lastName = 'Last name is required';
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, rowNumber: row.rowNumber, fields };
  }

  const dob = row.dateOfBirth?.trim()
    ? parseImportDateOfBirth(row.dateOfBirth)
    : undefined;

  return {
    ok: true,
    rowNumber: row.rowNumber,
    email,
    emailKey: email.toLowerCase(),
    assignedAdviserEmail: row.assignedAdviserEmail,
    input: {
      clientType: clientType.value,
      title: row.title,
      firstName: row.firstName,
      lastName: row.lastName,
      companyName: row.companyName,
      companyNumber: row.companyNumber,
      email,
      phone: row.phone,
      dateOfBirth: dob && 'iso' in dob ? dob.iso : undefined,
      employmentStatus: 'value' in employment ? employment.value : undefined,
      annualIncome: 'value' in income ? income.value : undefined,
      isReferred: false,
      insurerName: row.insurerName,
    },
  };
}

export async function runClientImport(
  orgId: string,
  userId: string | undefined,
  body: ImportClientsRequest,
  deps: ImportClientsDeps,
): Promise<ImportClientsResult | ImportClientsError> {
  if (body.rows.length === 0) return { error: 'EMPTY' };
  if (body.rows.length > CLIENT_IMPORT_HARD_MAX_ROWS) return { error: 'TOO_LARGE' };

  const existingKeys = new Set(
    (await deps.listExistingEmails(orgId)).map((email) => email.trim().toLowerCase()),
  );
  const seenInFile = new Set<string>();
  const skipEmails = body.sendWelcomeEmails !== true;

  const results: ImportClientRowResult[] = [];
  const pendingCreates: Array<Extract<PreparedImportRow, { ok: true }>> = [];

  for (const row of body.rows) {
    const prepared = prepareImportRow(row);
    if (!prepared.ok) {
      results.push({
        rowNumber: prepared.rowNumber,
        status: 'FAILED',
        fields: prepared.fields,
      });
      continue;
    }

    if (existingKeys.has(prepared.emailKey)) {
      results.push({ rowNumber: prepared.rowNumber, status: 'SKIPPED' });
      continue;
    }

    if (seenInFile.has(prepared.emailKey)) {
      results.push({
        rowNumber: prepared.rowNumber,
        status: 'FAILED',
        fields: { email: 'Duplicate email in this file' },
      });
      continue;
    }

    seenInFile.add(prepared.emailKey);
    pendingCreates.push(prepared);
  }

  const memberCache = new Map<string, ImportMemberRef | null>();

  async function resolveMember(email: string): Promise<ImportMemberRef | null> {
    const key = email.trim().toLowerCase();
    if (memberCache.has(key)) return memberCache.get(key) ?? null;
    const member = await deps.findMemberByEmail(orgId, key);
    memberCache.set(key, member);
    return member;
  }

  for (let i = 0; i < pendingCreates.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = pendingCreates.slice(i, i + IMPORT_CHUNK_SIZE);
    for (const row of chunk) {
      let assignedMemberId: string | undefined;
      if (row.assignedAdviserEmail?.trim()) {
        const member = await resolveMember(row.assignedAdviserEmail);
        if (!member) {
          results.push({
            rowNumber: row.rowNumber,
            status: 'FAILED',
            fields: { assignedAdviserEmail: 'No adviser with this email in the firm' },
          });
          seenInFile.delete(row.emailKey);
          continue;
        }
        assignedMemberId = member.id;
      }

      try {
        const created = await deps.createClient(
          orgId,
          { ...row.input, assignedMemberId },
          { skipEmails },
        );

        if ('error' in created) {
          results.push({
            rowNumber: row.rowNumber,
            status: 'FAILED',
            fields: created.fields ?? { email: 'Could not create client' },
          });
          seenInFile.delete(row.emailKey);
          continue;
        }

        existingKeys.add(row.emailKey);
        results.push({
          rowNumber: row.rowNumber,
          status: 'CREATED',
          clientId: created.client.id,
          referenceNumber: created.client.referenceNumber,
        });
      } catch {
        results.push({
          rowNumber: row.rowNumber,
          status: 'FAILED',
          fields: { email: 'Could not create client' },
        });
        seenInFile.delete(row.emailKey);
      }
    }
  }

  results.sort((a, b) => a.rowNumber - b.rowNumber);

  const created = results.filter((row) => row.status === 'CREATED').length;
  const skipped = results.filter((row) => row.status === 'SKIPPED').length;
  const failed = results.filter((row) => row.status === 'FAILED').length;

  await deps.logAudit({
    orgId,
    userId,
    entityType: 'Organisation',
    entityId: orgId,
    action: 'CLIENTS_IMPORTED',
    diff: {
      after: {
        fileName: body.fileName,
        created,
        skipped,
        failed,
      },
    },
  });

  return { created, skipped, failed, results };
}

export function buildClientImportTemplateCsv(): string {
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  return `${CLIENT_IMPORT_TEMPLATE_HEADERS.map(escape).join(',')}\n${CLIENT_IMPORT_TEMPLATE_EXAMPLE_ROW.map(escape).join(',')}\n`;
}
