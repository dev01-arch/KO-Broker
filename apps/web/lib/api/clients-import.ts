/**
 * PRD-17 — batch client import (JSON rows). Spreadsheets are parsed in the browser.
 */

import type { ImportClientsResult } from '@ko/types';
import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { createClientForOrg } from '@/lib/api/clients-data';
import { logAuditEvent } from '@/lib/compliance/audit';
import {
  runClientImport,
  type ImportClientsDeps,
  type ImportClientsError,
  type ImportClientsRequest,
  type ImportMemberRef,
} from '@/lib/api/clients-import-logic';

export {
  buildClientImportTemplateCsv,
  parseImportAnnualIncome,
  parseImportClientType,
  parseImportDateOfBirth,
  parseImportEmploymentStatus,
  prepareImportRow,
  runClientImport,
} from '@/lib/api/clients-import-logic';
export type { ImportClientsDeps, ImportClientsError, ImportClientsRequest } from '@/lib/api/clients-import-logic';

function shouldUseDevStore(error: unknown) {
  return process.env.NODE_ENV === 'development' && isPrismaConnectionError(error);
}

async function defaultListExistingEmails(orgId: string): Promise<string[]> {
  try {
    const rows = await prisma.client.findMany({
      where: { orgId },
      select: { email: true },
    });
    return rows.map((row) => row.email);
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.listClientEmails(orgId);
  }
}

async function defaultFindMemberByEmail(orgId: string, email: string): Promise<ImportMemberRef | null> {
  const normalised = email.trim().toLowerCase();
  try {
    const member = await prisma.organisationMember.findFirst({
      where: {
        orgId,
        isActive: true,
        email: { equals: normalised, mode: 'insensitive' },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return member;
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    const member = devStore.findMemberByEmail(orgId, normalised);
    if (!member) return null;
    return {
      id: member.id,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
    };
  }
}

const defaultDeps: ImportClientsDeps = {
  listExistingEmails: defaultListExistingEmails,
  findMemberByEmail: defaultFindMemberByEmail,
  createClient: createClientForOrg,
  logAudit: logAuditEvent,
};

export async function importClientsForOrg(
  orgId: string,
  userId: string | undefined,
  body: ImportClientsRequest,
  deps?: Partial<ImportClientsDeps>,
): Promise<ImportClientsResult | ImportClientsError> {
  return runClientImport(orgId, userId, body, {
    ...defaultDeps,
    ...deps,
  });
}
