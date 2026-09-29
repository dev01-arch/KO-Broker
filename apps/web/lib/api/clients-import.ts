/**
 * PRD-17 — batch client import (JSON rows). Spreadsheets are parsed in the browser.
 */

import type { ImportClientsResult } from '@ko/types';
import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { createClientForOrg } from '@/lib/api/clients-data';
import { createPropertyForClient } from '@/lib/api/properties-data';
import { logAuditEvent } from '@/lib/compliance/audit';
import {
  runClientImport,
  splitAdviserDisplayName,
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

async function defaultFindMemberByName(orgId: string, name: string): Promise<ImportMemberRef | null> {
  const parts = splitAdviserDisplayName(name);
  if (!parts) return null;
  try {
    const matches = await prisma.organisationMember.findMany({
      where: {
        orgId,
        isActive: true,
        firstName: { equals: parts.firstName, mode: 'insensitive' },
        lastName: { equals: parts.lastName, mode: 'insensitive' },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
      take: 2,
    });
    return matches.length === 1 ? matches[0]! : null;
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.findMemberByName(orgId, parts.firstName, parts.lastName);
  }
}

async function defaultCreateHomeProperty(
  orgId: string,
  clientId: string,
  address: { line1?: string; postcode: string },
  userId?: string,
): Promise<void> {
  try {
    await createPropertyForClient(
      orgId,
      clientId,
      {
        postcode: address.postcode,
        address: address.line1 ? { line1: address.line1 } : undefined,
        type: 'RESIDENTIAL',
      },
      userId,
    );
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
  }
}

const defaultDeps: ImportClientsDeps = {
  listExistingEmails: defaultListExistingEmails,
  findMemberByEmail: defaultFindMemberByEmail,
  findMemberByName: defaultFindMemberByName,
  createHomeProperty: defaultCreateHomeProperty,
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
