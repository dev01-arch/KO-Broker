/**
 * PRD-17 backend import execution tests.
 * Run: node --experimental-strip-types --test lib/api/clients-import-logic.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ImportClientsSchema } from '@ko/types';
import {
  parseImportDateOfBirth,
  prepareImportRow,
  runClientImport,
  type ImportClientsDeps,
} from './clients-import-logic.ts';

function person(overrides: Record<string, unknown> = {}) {
  return {
    rowNumber: 1,
    firstName: 'Jane',
    lastName: 'Adeyemi',
    email: 'jane.adeyemi@example.com',
    ...overrides,
  };
}

function mockDeps(overrides: Partial<ImportClientsDeps> = {}): ImportClientsDeps & {
  created: Array<{ email: string; skipEmails?: boolean }>;
  audited: unknown[];
} {
  const created: Array<{ email: string; skipEmails?: boolean }> = [];
  const audited: unknown[] = [];
  return {
    created,
    audited,
    listExistingEmails: async () => [],
    findMemberByEmail: async () => null,
    createClient: async (_orgId, input, options) => {
      created.push({ email: input.email, skipEmails: options?.skipEmails });
      return {
        client: {
          id: `id-${input.email}`,
          referenceNumber: 'KOC-2026-0001',
          firstName: input.firstName ?? input.companyName ?? '',
          lastName: input.lastName ?? '—',
          email: input.email,
        },
      };
    },
    logAudit: async (event) => {
      audited.push(event);
    },
    ...overrides,
  };
}

describe('parseImportDateOfBirth', () => {
  it('accepts ISO and DD/MM/YYYY', () => {
    assert.deepEqual(parseImportDateOfBirth('1988-03-14'), { iso: '1988-03-14' });
    assert.deepEqual(parseImportDateOfBirth('14/03/1988'), { iso: '1988-03-14' });
  });

  it('rejects ambiguous 01/02/03', () => {
    const parsed = parseImportDateOfBirth('01/02/03');
    assert.equal('error' in parsed, true);
  });
});

describe('prepareImportRow', () => {
  it('fails COMPANY rows without a company number', () => {
    const prepared = prepareImportRow({
      rowNumber: 1,
      email: 'acme@example.com',
      clientType: 'COMPANY',
      companyName: 'Acme Ltd',
    });
    assert.equal(prepared.ok, false);
    if (!prepared.ok) {
      assert.equal(prepared.fields.companyNumber, 'Company registration number is required');
    }
  });

  it('fails missing firstName on INDIVIDUAL', () => {
    const prepared = prepareImportRow(person({ firstName: undefined }));
    assert.equal(prepared.ok, false);
    if (!prepared.ok) {
      assert.equal(prepared.fields.firstName, 'First name is required');
    }
  });
});

describe('ImportClientsSchema', () => {
  it('defaults sendWelcomeEmails to false when omitted', () => {
    const parsed = ImportClientsSchema.parse({
      rows: [person()],
    });
    assert.equal(parsed.sendWelcomeEmails, false);
  });
});

describe('runClientImport', () => {
  it('passes skipEmails: true when sendWelcomeEmails is omitted/false', async () => {
    const deps = mockDeps();
    const result = await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      rows: [person()],
    }), deps);
    assert.equal('error' in result, false);
    if ('error' in result) return;
    assert.equal(result.created, 1);
    assert.equal(deps.created[0]?.skipEmails, true);
  });

  it('passes skipEmails: false when sendWelcomeEmails is true', async () => {
    const deps = mockDeps();
    await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      sendWelcomeEmails: true,
      rows: [person()],
    }), deps);
    assert.equal(deps.created[0]?.skipEmails, false);
  });

  it('skips duplicate emails already in the org', async () => {
    const deps = mockDeps({
      listExistingEmails: async () => ['jane.adeyemi@example.com'],
    });
    const result = await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      rows: [person()],
    }), deps);
    assert.equal('error' in result, false);
    if ('error' in result) return;
    assert.equal(result.skipped, 1);
    assert.equal(result.created, 0);
    assert.equal(deps.created.length, 0);
  });

  it('creates the first duplicate in the payload and fails the second', async () => {
    const deps = mockDeps();
    const result = await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      rows: [
        person({ rowNumber: 1 }),
        person({ rowNumber: 2, firstName: 'Janet' }),
      ],
    }), deps);
    assert.equal('error' in result, false);
    if ('error' in result) return;
    assert.equal(result.created, 1);
    assert.equal(result.failed, 1);
    assert.equal(result.results[1]?.status, 'FAILED');
    assert.equal(deps.created.length, 1);
  });

  it('fails a missing firstName row without blocking siblings', async () => {
    const deps = mockDeps();
    const result = await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      rows: [
        person({ rowNumber: 1, firstName: undefined }),
        person({ rowNumber: 2, email: 'second@example.com' }),
      ],
    }), deps);
    assert.equal('error' in result, false);
    if ('error' in result) return;
    assert.equal(result.failed, 1);
    assert.equal(result.created, 1);
    assert.equal(result.results[0]?.status, 'FAILED');
    assert.equal(result.results[1]?.status, 'CREATED');
  });

  it('fails COMPANY rows without a company number only', async () => {
    const deps = mockDeps();
    const result = await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      rows: [
        {
          rowNumber: 1,
          email: 'acme@example.com',
          clientType: 'COMPANY',
          companyName: 'Acme Ltd',
        },
        person({ rowNumber: 2, email: 'ok@example.com' }),
      ],
    }), deps);
    assert.equal('error' in result, false);
    if ('error' in result) return;
    assert.equal(result.failed, 1);
    assert.equal(result.created, 1);
    assert.equal(result.results[0]?.fields?.companyNumber, 'Company registration number is required');
  });

  it('fails unknown adviser emails on that row only', async () => {
    const deps = mockDeps();
    const result = await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      rows: [
        person({ rowNumber: 1, assignedAdviserEmail: 'missing@example.com' }),
        person({ rowNumber: 2, email: 'ok@example.com' }),
      ],
    }), deps);
    assert.equal('error' in result, false);
    if ('error' in result) return;
    assert.equal(result.failed, 1);
    assert.equal(result.created, 1);
    assert.equal(result.results[0]?.fields?.assignedAdviserEmail, 'No adviser with this email in the firm');
  });

  it('returns TOO_LARGE over 1000 rows', async () => {
    const deps = mockDeps();
    const rows = Array.from({ length: 1001 }, (_, index) => person({
      rowNumber: index + 1,
      email: `person${index}@example.com`,
    }));
    const result = await runClientImport('org-1', 'user-1', { rows, sendWelcomeEmails: false, duplicateEmail: 'skip' }, deps);
    assert.deepEqual(result, { error: 'TOO_LARGE' });
    assert.equal(deps.created.length, 0);
  });

  it('writes a CLIENTS_IMPORTED audit event', async () => {
    const deps = mockDeps();
    await runClientImport('org-1', 'user-1', ImportClientsSchema.parse({
      fileName: 'book.csv',
      rows: [person()],
    }), deps);
    assert.equal(deps.audited.length, 1);
    const event = deps.audited[0] as { action: string; entityType: string };
    assert.equal(event.action, 'CLIENTS_IMPORTED');
    assert.equal(event.entityType, 'Organisation');
  });
});
