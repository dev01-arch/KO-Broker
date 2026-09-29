/**
 * PRD-17 — batch client import (JSON rows). Spreadsheets are parsed in the browser.
 */

import type { ImportClientsResult } from '@ko/types';
import { prisma } from '@/lib/db';
import { devStore } from '@/lib/api/dev-store';
import { isPrismaConnectionError } from '@/lib/api/prisma-errors';
import { createClientForOrg } from '@/lib/api/clients-data';
import { createPropertyForClient } from '@/lib/api/properties-data';
import { listInvitedAdvisersForOrg } from '@/lib/api/settings-data';
import { logAuditEvent } from '@/lib/compliance/audit';
import {
  matchAdviserByName,
  runClientImport,
  type AdviserNameCandidate,
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

function personName(firstName?: string | null, lastName?: string | null): string {
  return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}

function isPlaceholderAdviserName(firstName: string, lastName: string): boolean {
  return firstName.trim().toLowerCase() === 'admin' && lastName.trim().toLowerCase() === 'user';
}

async function loadAdviserCandidates(orgId: string): Promise<AdviserNameCandidate[]> {
  try {
    const [listed, members] = await Promise.all([
      listInvitedAdvisersForOrg(orgId),
      prisma.organisationMember.findMany({
        where: { orgId, isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);
    const membersById = new Map(members.map((member) => [member.id, member]));
    const byId = new Map<string, AdviserNameCandidate>();

    for (const adviser of listed) {
      if (!adviser.memberId) continue;
      const member = membersById.get(adviser.memberId);
      const accountName = personName(adviser.firstName, adviser.lastName);
      let firstName = member?.firstName ?? adviser.firstName ?? '';
      let lastName = member?.lastName ?? adviser.lastName ?? '';
      if (
        member &&
        accountName &&
        isPlaceholderAdviserName(member.firstName, member.lastName) &&
        !isPlaceholderAdviserName(adviser.firstName ?? '', adviser.lastName ?? '')
      ) {
        firstName = adviser.firstName ?? firstName;
        lastName = adviser.lastName ?? lastName;
        await prisma.organisationMember.update({
          where: { id: member.id },
          data: { firstName, lastName },
        });
      }
      const names = [accountName, personName(firstName, lastName)].filter(Boolean);
      byId.set(adviser.memberId, {
        id: adviser.memberId,
        email: adviser.email,
        firstName,
        lastName,
        names,
      });
    }

    for (const member of members) {
      const name = personName(member.firstName, member.lastName);
      const existing = byId.get(member.id);
      if (existing) {
        if (name && !existing.names.includes(name)) existing.names.push(name);
        continue;
      }
      byId.set(member.id, {
        id: member.id,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        names: name ? [name] : [],
      });
    }

    return [...byId.values()];
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    return devStore.listAdvisersForAssignment(orgId).map((adviser) => ({
      id: adviser.memberId,
      email: adviser.email,
      firstName: adviser.firstName,
      lastName: adviser.lastName,
      names: [personName(adviser.firstName, adviser.lastName)].filter(Boolean),
    }));
  }
}

async function defaultAssignExistingClientAdviser(
  orgId: string,
  email: string,
  memberId: string,
): Promise<void> {
  try {
    await prisma.client.updateMany({
      where: {
        orgId,
        email: { equals: email, mode: 'insensitive' },
        assignedMemberId: null,
      },
      data: { assignedMemberId: memberId },
    });
  } catch (error) {
    if (!shouldUseDevStore(error)) throw error;
    devStore.assignClientAdviserIfEmpty(orgId, email, memberId);
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
  let candidates: Promise<AdviserNameCandidate[]> | null = null;
  return runClientImport(orgId, userId, body, {
    ...defaultDeps,
    findMemberByName: async (id, name) => {
      if (!candidates) candidates = loadAdviserCandidates(id);
      const match = matchAdviserByName(name, await candidates);
      if (!match) return null;
      return {
        id: match.id,
        email: match.email,
        firstName: match.firstName,
        lastName: match.lastName,
      };
    },
    assignExistingClientAdviser: defaultAssignExistingClientAdviser,
    ...deps,
  });
}
