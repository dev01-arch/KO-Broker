/**
 * Browser-side CSV / Excel parse + column mapping for PRD-17.
 * Do not import this file from API routes — the server never parses spreadsheets.
 */

import Papa from 'papaparse';
import {
  CLIENT_IMPORT_GUIDED_MAX_ROWS,
  CLIENT_IMPORT_HARD_MAX_ROWS,
  CLIENT_IMPORT_TEMPLATE_EXAMPLE_ROW,
  CLIENT_IMPORT_TEMPLATE_HEADERS,
  type ClientImportField,
  type ImportClientRow,
} from '@ko/types';

export const CLIENT_IMPORT_FIELDS = CLIENT_IMPORT_TEMPLATE_HEADERS;

export const CLIENT_IMPORT_FIELD_LABELS: Record<ClientImportField, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  title: 'Title',
  dateOfBirth: 'Date of birth',
  employmentStatus: 'Employment status',
  annualIncome: 'Annual income',
  clientType: 'Client type',
  companyName: 'Company name',
  companyNumber: 'Company number',
  insurerName: 'Insurer',
  assignedAdviserEmail: 'Assigned adviser email',
};

const ALIASES: Record<ClientImportField, string[]> = {
  firstName: ['first name', 'forename', 'given name', 'first', 'firstname'],
  lastName: ['last name', 'surname', 'family name', 'last', 'lastname'],
  email: ['e-mail', 'email address', 'mail', 'email'],
  phone: ['mobile', 'tel', 'telephone', 'phone number', 'phone'],
  title: ['title', 'salutation'],
  dateOfBirth: ['dob', 'date of birth', 'birth date', 'dateofbirth'],
  employmentStatus: ['employment', 'employment status', 'occup status', 'employmentstatus'],
  annualIncome: ['income', 'salary', 'gross income', 'annual income', 'annualincome'],
  clientType: ['type', 'client type', 'clienttype'],
  companyName: ['company', 'company name', 'organisation', 'organization', 'companyname'],
  companyNumber: ['company number', 'crn', 'companies house', 'companynumber'],
  insurerName: ['insurer', 'insurance', 'insurername'],
  assignedAdviserEmail: ['adviser email', 'broker email', 'assigned to', 'assignedadviseremail'],
};

export function normalizeImportHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[*_]/g, '').replace(/\s+/g, ' ');
}

export function autoMapImportHeaders(headers: string[]): Record<ClientImportField, string | null> {
  const mapping = {} as Record<ClientImportField, string | null>;
  const used = new Set<string>();

  for (const field of CLIENT_IMPORT_FIELDS) {
    const normalisedField = normalizeImportHeader(field);
    const aliases = ALIASES[field];
    const match = headers.find((header) => {
      if (used.has(header)) return false;
      const normalised = normalizeImportHeader(header);
      return normalised === normalisedField || aliases.includes(normalised);
    });
    mapping[field] = match ?? null;
    if (match) used.add(match);
  }

  return mapping;
}

export function ignoredImportHeaders(
  headers: string[],
  mapping: Record<ClientImportField, string | null>,
): string[] {
  const mapped = new Set(Object.values(mapping).filter((value): value is string => Boolean(value)));
  return headers.filter((header) => !mapped.has(header));
}

export function parseImportAnnualIncome(raw: string): { value?: number } | { error: string } {
  const stripped = raw.replace(/[£,\s]/g, '');
  if (!stripped) return { value: undefined };
  const parsed = Number(stripped);
  if (!Number.isFinite(parsed) || parsed <= 0) return { error: 'Invalid annual income' };
  return { value: parsed };
}

export function parseImportEmploymentStatus(
  raw: string,
): { value?: ImportClientRow['employmentStatus'] } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: undefined };
  const normalised = trimmed.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const mapped: Record<string, string> = {
    employed: 'EMPLOYED',
    'self employed': 'SELF_EMPLOYED',
    selfemployed: 'SELF_EMPLOYED',
    contractor: 'CONTRACTOR',
    retired: 'RETIRED',
    unemployed: 'UNEMPLOYED',
  };
  const asEnum = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if (['EMPLOYED', 'SELF_EMPLOYED', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED'].includes(asEnum)) {
    return { value: asEnum };
  }
  const aliased = mapped[normalised];
  if (aliased) return { value: aliased };
  return { error: 'Unknown employment status' };
}

export function parseImportClientType(
  raw: string,
  companyName?: string,
  companyNumber?: string,
): { value: 'INDIVIDUAL' | 'COMPANY' } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed) {
    const normalised = trimmed.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    if (trimmed.toUpperCase() === 'COMPANY' || normalised === 'company' || normalised === 'limited' || normalised === 'ltd') {
      return { value: 'COMPANY' };
    }
    if (trimmed.toUpperCase() === 'INDIVIDUAL' || normalised === 'individual' || normalised === 'person') {
      return { value: 'INDIVIDUAL' };
    }
    return { error: 'Unknown client type' };
  }
  if (companyName?.trim() && companyNumber?.trim()) return { value: 'COMPANY' };
  return { value: 'INDIVIDUAL' };
}

export function parseImportDateOfBirth(raw: string): { iso: string } | { error: string } {
  const value = raw.trim();
  if (!value) return { error: 'Date of birth is required' };

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return { error: 'Invalid date of birth' };
    }
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
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return { error: 'Invalid date of birth' };
    }
    return {
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  return { error: 'Use ISO (YYYY-MM-DD) or DD/MM/YYYY' };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedImportMatrix = {
  fileName: string;
  headers: string[];
  rows: string[][];
  overGuidedMax: boolean;
};

export type ParseImportError = {
  error: string;
  code: 'EMPTY' | 'NO_HEADER' | 'NO_ROWS' | 'TOO_LARGE' | 'UNREADABLE';
};

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => !String(cell ?? '').trim());
}

function matrixFromAoA(aoa: unknown[][]): { headers: string[]; rows: string[][] } | ParseImportError {
  const cleaned = aoa
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []))
    .filter((row) => !isEmptyRow(row));
  if (cleaned.length === 0) return { error: 'This file is empty.', code: 'EMPTY' };
  const headers = cleaned[0].map((header) => header.trim());
  if (headers.every((header) => !header)) {
    return { error: 'The first row must contain column headers.', code: 'NO_HEADER' };
  }
  const rows = cleaned.slice(1);
  if (rows.length === 0) {
    return { error: 'No data rows found under the header row.', code: 'NO_ROWS' };
  }
  if (rows.length > CLIENT_IMPORT_HARD_MAX_ROWS) {
    return {
      error: 'Split the file (max 1,000 rows per import).',
      code: 'TOO_LARGE',
    };
  }
  return { headers, rows };
}

export function parseClientImportCsv(text: string, fileName: string): ParsedImportMatrix | ParseImportError {
  if (!text.trim()) return { error: 'This file is empty.', code: 'EMPTY' };
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  });
  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    return { error: 'Could not read this CSV. Check the file and try again.', code: 'UNREADABLE' };
  }
  const matrix = matrixFromAoA(parsed.data);
  if ('error' in matrix) return matrix;
  return {
    fileName,
    headers: matrix.headers,
    rows: matrix.rows,
    overGuidedMax: matrix.rows.length > CLIENT_IMPORT_GUIDED_MAX_ROWS,
  };
}

export async function parseClientImportWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<ParsedImportMatrix | ParseImportError> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', raw: false, cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return { error: 'This workbook has no sheets.', code: 'EMPTY' };
    const sheet = workbook.Sheets[firstSheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });
    const matrix = matrixFromAoA(aoa);
    if ('error' in matrix) return matrix;
    return {
      fileName,
      headers: matrix.headers,
      rows: matrix.rows,
      overGuidedMax: matrix.rows.length > CLIENT_IMPORT_GUIDED_MAX_ROWS,
    };
  } catch {
    const isXls = fileName.toLowerCase().endsWith('.xls') && !fileName.toLowerCase().endsWith('.xlsx');
    return {
      error: isXls
        ? 'Could not read this .xls file. Save As .xlsx or CSV and try again.'
        : 'Could not read this spreadsheet. Save As .xlsx or CSV and try again.',
      code: 'UNREADABLE',
    };
  }
}

export async function parseClientImportFile(file: File): Promise<ParsedImportMatrix | ParseImportError> {
  if (file.size === 0) return { error: 'This file is empty.', code: 'EMPTY' };
  const name = file.name || 'clients.csv';
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = await file.text();
    return parseClientImportCsv(text, name);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseClientImportWorkbook(buffer, name);
  }
  return {
    error: 'Use a .csv or .xlsx file (older .xls is best-effort).',
    code: 'UNREADABLE',
  };
}

export function sampleColumnValues(rows: string[][], columnIndex: number, count = 3): string[] {
  const samples: string[] = [];
  for (const row of rows) {
    const value = String(row[columnIndex] ?? '').trim();
    if (!value) continue;
    samples.push(value);
    if (samples.length >= count) break;
  }
  return samples;
}

function cell(row: string[], headers: string[], header: string | null): string {
  if (!header) return '';
  const index = headers.indexOf(header);
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

export type PreviewImportStatus = 'create' | 'skip' | 'fail';

export type PreviewImportRow = {
  rowNumber: number;
  name: string;
  email: string;
  status: PreviewImportStatus;
  message?: string;
  payload: ImportClientRow;
};

export function mapParsedRows(options: {
  headers: string[];
  rows: string[][];
  mapping: Record<ClientImportField, string | null>;
  existingEmails: string[];
}): PreviewImportRow[] {
  const existing = new Set(options.existingEmails.map((email) => email.trim().toLowerCase()));
  const seenInFile = new Set<string>();

  return options.rows.map((row, index) => {
    const rowNumber = index + 1;
    const get = (field: ClientImportField) => cell(row, options.headers, options.mapping[field]);
    const firstName = get('firstName');
    const lastName = get('lastName');
    const email = get('email');
    const companyName = get('companyName');
    const companyNumber = get('companyNumber');
    const employmentRaw = get('employmentStatus');
    const incomeRaw = get('annualIncome');
    const typeRaw = get('clientType');
    const dobRaw = get('dateOfBirth');

    const fields: Record<string, string> = {};
    if (!email) fields.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) fields.email = 'Valid email is required';

    const employment = parseImportEmploymentStatus(employmentRaw);
    if ('error' in employment) fields.employmentStatus = employment.error;

    const income = parseImportAnnualIncome(incomeRaw);
    if ('error' in income) fields.annualIncome = income.error;

    const clientType = parseImportClientType(typeRaw, companyName, companyNumber);
    if ('error' in clientType) {
      fields.clientType = clientType.error;
    } else if (clientType.value === 'COMPANY') {
      if (!companyName) fields.companyName = 'Company name is required';
      if (!companyNumber) fields.companyNumber = 'Company registration number is required';
    } else {
      if (!firstName) fields.firstName = 'First name is required';
      if (!lastName) fields.lastName = 'Last name is required';
    }

    if (dobRaw) {
      const dob = parseImportDateOfBirth(dobRaw);
      if ('error' in dob) fields.dateOfBirth = dob.error;
    }

    const emailKey = email.toLowerCase();
    let status: PreviewImportStatus = 'create';
    let message: string | undefined;

    if (Object.keys(fields).length > 0) {
      status = 'fail';
      message = Object.values(fields)[0];
    } else if (existing.has(emailKey)) {
      status = 'skip';
      message = 'Email already in this firm';
    } else if (seenInFile.has(emailKey)) {
      status = 'fail';
      message = 'Duplicate email in this file';
      fields.email = 'Duplicate email in this file';
    } else {
      seenInFile.add(emailKey);
    }

    const payload: ImportClientRow = {
      rowNumber,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email,
      phone: get('phone') || undefined,
      title: get('title') || undefined,
      dateOfBirth:
        dobRaw && !('error' in parseImportDateOfBirth(dobRaw))
          ? (parseImportDateOfBirth(dobRaw) as { iso: string }).iso
          : dobRaw || undefined,
      employmentStatus: 'value' in employment ? employment.value : undefined,
      annualIncome: 'value' in income ? income.value : undefined,
      clientType: 'value' in clientType ? clientType.value : undefined,
      companyName: companyName || undefined,
      companyNumber: companyNumber || undefined,
      insurerName: get('insurerName') || undefined,
      assignedAdviserEmail: get('assignedAdviserEmail') || undefined,
    };

    const name =
      clientType && 'value' in clientType && clientType.value === 'COMPANY' && companyName
        ? companyName
        : [firstName, lastName].filter(Boolean).join(' ') || email || `Row ${rowNumber}`;

    return { rowNumber, name, email, status, message, payload };
  });
}

export function mappingReady(
  mapping: Record<ClientImportField, string | null>,
): { ready: boolean; reason?: string } {
  if (!mapping.email) return { ready: false, reason: 'Map the email column to continue.' };
  const hasPerson = Boolean(mapping.firstName && mapping.lastName);
  const hasCompany = Boolean(mapping.companyName && mapping.companyNumber);
  if (!hasPerson && !hasCompany) {
    return {
      ready: false,
      reason: 'Map first + last name, or company name + number.',
    };
  }
  return { ready: true };
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildClientImportTemplateCsv(): string {
  return `${CLIENT_IMPORT_TEMPLATE_HEADERS.map(escapeCsvCell).join(',')}\n${CLIENT_IMPORT_TEMPLATE_EXAMPLE_ROW.map(escapeCsvCell).join(',')}\n`;
}

/** Live-demo sample with unique emails (not the Jane/Sam/Acme fixture). */
export const CLIENT_IMPORT_DEMO_ROWS: string[][] = [
  ['Amara', 'Nwosu', 'amara.nwosu@example.com', '07700901001', 'Ms', '21/06/1991', 'EMPLOYED', '78000', 'INDIVIDUAL', '', '', 'Aviva', ''],
  ['Tom', 'Hughes', 'tom.hughes@example.com', '07700901002', 'Mr', '09/01/1984', 'SELF_EMPLOYED', '94500', 'INDIVIDUAL', '', '', 'Legal & General', ''],
  ['Sophie', 'Rahman', 'sophie.rahman@example.com', '07700901003', 'Mrs', '30/11/1995', 'CONTRACTOR', '62000', 'INDIVIDUAL', '', '', 'Zurich', ''],
  ['Callum', 'Reid', 'callum.reid@example.com', '07700901004', 'Mr', '04/08/1976', 'EMPLOYED', '110000', 'INDIVIDUAL', '', '', 'Scottish Widows', ''],
  ['', '', 'westbridge.property@example.com', '', '', '', '', '', 'COMPANY', 'Westbridge Property Ltd', '87654321', '', ''],
];

export function buildClientImportDemoCsv(): string {
  return [
    CLIENT_IMPORT_TEMPLATE_HEADERS.map(escapeCsvCell).join(','),
    ...CLIENT_IMPORT_DEMO_ROWS.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n') + '\n';
}

export function downloadTextFile(filename: string, contents: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildFailedRowsCsv(rows: PreviewImportRow[]): string {
  const failed = rows.filter((row) => row.status === 'fail');
  const header = [...CLIENT_IMPORT_TEMPLATE_HEADERS, 'error'];
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  };
  const lines = [
    header.map(escape).join(','),
    ...failed.map((row) =>
      [
        row.payload.firstName ?? '',
        row.payload.lastName ?? '',
        row.payload.email ?? '',
        row.payload.phone ?? '',
        row.payload.title ?? '',
        row.payload.dateOfBirth ?? '',
        row.payload.employmentStatus ?? '',
        row.payload.annualIncome != null ? String(row.payload.annualIncome) : '',
        row.payload.clientType ?? '',
        row.payload.companyName ?? '',
        row.payload.companyNumber ?? '',
        row.payload.insurerName ?? '',
        row.payload.assignedAdviserEmail ?? '',
        row.message ?? 'Error',
      ]
        .map(escape)
        .join(','),
    ),
  ];
  return `${lines.join('\n')}\n`;
}
