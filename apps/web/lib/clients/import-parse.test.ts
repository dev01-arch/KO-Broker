/**
 * PRD-17 browser parse + column mapping tests.
 * Run: node --experimental-strip-types --test lib/clients/import-parse.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  autoMapImportHeaders,
  buildClientImportDemoCsv,
  buildClientImportTemplateCsv,
  mapParsedRows,
  mappingReady,
  parseClientImportCsv,
  parseImportAnnualIncome,
  parseImportDateOfBirth,
  parseImportEmploymentStatus,
} from './import-parse.ts';

describe('autoMapImportHeaders', () => {
  it('maps canonical headers and aliases', () => {
    const mapping = autoMapImportHeaders(['Forename', 'Surname', 'E-mail', 'Mobile', 'DOB']);
    assert.equal(mapping.firstName, 'Forename');
    assert.equal(mapping.lastName, 'Surname');
    assert.equal(mapping.email, 'E-mail');
    assert.equal(mapping.phone, 'Mobile');
    assert.equal(mapping.dateOfBirth, 'DOB');
  });
});

describe('parse helpers', () => {
  it('strips £ and commas from income', () => {
    assert.deepEqual(parseImportAnnualIncome('£65,000'), { value: 65000 });
  });

  it('maps employment labels and fails unknowns', () => {
    assert.deepEqual(parseImportEmploymentStatus('self-employed'), { value: 'SELF_EMPLOYED' });
    assert.equal('error' in parseImportEmploymentStatus('gig worker'), true);
    assert.deepEqual(parseImportEmploymentStatus(''), { value: undefined });
  });

  it('rejects 01/02/03 dates', () => {
    assert.equal('error' in parseImportDateOfBirth('01/02/03'), true);
    assert.deepEqual(parseImportDateOfBirth('14/03/1988'), { iso: '1988-03-14' });
  });
});

describe('parseClientImportCsv', () => {
  it('requires a header row and skips empty rows', () => {
    const parsed = parseClientImportCsv(
      'firstName,lastName,email\nJane,Adeyemi,jane.adeyemi@example.com\n,,\n',
      'sample.csv',
    );
    assert.equal('error' in parsed, false);
    if ('error' in parsed) return;
    assert.equal(parsed.rows.length, 1);
  });

  it('returns NO_ROWS when only headers exist', () => {
    const parsed = parseClientImportCsv('firstName,lastName,email\n', 'empty.csv');
    assert.equal('error' in parsed, true);
    if ('error' in parsed) assert.equal(parsed.code, 'NO_ROWS');
  });
});

describe('mapParsedRows', () => {
  it('marks org duplicates as skip and in-file duplicates as fail', () => {
    const mapping = autoMapImportHeaders(['firstName', 'lastName', 'email']);
    const rows = mapParsedRows({
      headers: ['firstName', 'lastName', 'email'],
      rows: [
        ['Jane', 'Adeyemi', 'jane@example.com'],
        ['Janet', 'Adeyemi', 'jane@example.com'],
        ['Sam', 'Okeke', 'existing@example.com'],
      ],
      mapping,
      existingEmails: ['existing@example.com'],
    });
    assert.equal(rows[0].status, 'create');
    assert.equal(rows[1].status, 'fail');
    assert.equal(rows[2].status, 'skip');
  });
});

describe('mappingReady', () => {
  it('requires email plus identity columns', () => {
    assert.equal(mappingReady({
      ...autoMapImportHeaders([]),
      email: 'Email',
    }).ready, false);
    assert.equal(mappingReady({
      ...autoMapImportHeaders([]),
      email: 'Email',
      firstName: 'First',
      lastName: 'Last',
    }).ready, true);
  });
});

describe('template', () => {
  it('starts with canonical headers', () => {
    const csv = buildClientImportTemplateCsv();
    assert.equal(csv.startsWith('firstName,lastName,email,'), true);
    assert.equal(csv.includes('jane.adeyemi@example.com'), true);
  });
});

describe('demo sample', () => {
  it('uses canonical headers and unique demo emails', () => {
    const csv = buildClientImportDemoCsv();
    const parsed = parseClientImportCsv(csv, 'kompass-clients-demo.csv');
    assert.equal('error' in parsed, false);
    if ('error' in parsed) return;
    assert.equal(parsed.rows.length, 5);
    assert.equal(csv.includes('amara.nwosu@example.com'), true);
    assert.equal(csv.includes('westbridge.property@example.com'), true);
    assert.equal(csv.includes('jane.adeyemi@example.com'), false);
  });
});
