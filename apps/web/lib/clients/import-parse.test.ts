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
  ignoredImportHeaders,
  mapParsedRows,
  mappingReady,
  parseClientImportCsv,
  parseImportAddress,
  parseImportAnnualIncome,
  parseImportDateOfBirth,
  parseImportEmploymentStatus,
  splitImportPersonName,
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

const CLIENTTREE_CSV = `Entry date,Full Name,Date of birth,Email,Phone,Address,Adviser,Portal created
23/07/2026,Ada Example,05/12/2001,ada.example@example.com,07700900111,"10 Test Lane, , SW1A 1AA",,No
23/07/2026,Grace Sample,14/11/1967,grace.sample@example.com,07700900112,"10 Test Lane, , SW1A 2AA",Olu Example,No
23/07/2026,Mary Ann Demo,05/12/2007,mary.demo@example.com,07700900113,"1 Baxter Place, , EC1A 1BB",,No
22/07/2026,Ernestina Example,03/06/1985,ernestina.example@example.com,07700900114,"2 Demo Road, Richmond, TW10 7LR",Olu Example,No
22/07/2026,Gaubys Example,26/11/1985,gaubys.example@example.com,07700900115,"101 Sample Street, Rochester, ME2 3EX",,No
`;

describe('Clienttree CRM export', () => {
  it('splits full names and keeps the KO template mapping unchanged', () => {
    assert.deepEqual(splitImportPersonName('Ada Example'), {
      firstName: 'Ada',
      lastName: 'Example',
    });
    assert.deepEqual(splitImportPersonName('Mr John Smith'), {
      firstName: 'John',
      lastName: 'Smith',
    });
    const canonical = autoMapImportHeaders(['firstName', 'lastName', 'email']);
    assert.equal(canonical.firstName, 'firstName');
    assert.equal(canonical.lastName, 'lastName');
  });

  it('maps a Clienttree CSV into creatable client rows', () => {
    const parsed = parseClientImportCsv(CLIENTTREE_CSV, '01 Sample Brokerage CRM Clients Page.csv');
    assert.equal('error' in parsed, false);
    if ('error' in parsed) return;

    const mapping = autoMapImportHeaders(parsed.headers);
    assert.equal(mappingReady(mapping).ready, true);
    assert.equal(mapping.firstName, 'Full Name');
    assert.equal(mapping.lastName, 'Full Name');
    assert.equal(mapping.email, 'Email');
    assert.equal(mapping.phone, 'Phone');
    assert.equal(mapping.dateOfBirth, 'Date of birth');
    assert.deepEqual(ignoredImportHeaders(parsed.headers, mapping), ['Entry date', 'Portal created']);

    const rows = mapParsedRows({
      headers: parsed.headers,
      rows: parsed.rows,
      mapping,
      existingEmails: [],
    });
    assert.equal(rows.length, 5);
    assert.equal(rows.every((row) => row.status === 'create'), true);
    assert.equal(rows[0]?.payload.firstName, 'Ada');
    assert.equal(rows[0]?.payload.lastName, 'Example');
    assert.equal(rows[0]?.payload.dateOfBirth, '2001-12-05');
    assert.equal(rows[0]?.payload.phone, '07700900111');
    assert.equal(rows[0]?.payload.addressLine1, '10 Test Lane');
    assert.equal(rows[0]?.payload.postcode, 'SW1A 1AA');
    assert.equal(rows[0]?.payload.assignedAdviserName, undefined);
    assert.equal(rows[1]?.payload.assignedAdviserName, 'Olu Example');
    assert.equal(rows[1]?.payload.postcode, 'SW1A 2AA');
    assert.equal(rows[2]?.payload.firstName, 'Mary');
    assert.equal(rows[2]?.payload.lastName, 'Ann Demo');
    assert.equal(rows[3]?.payload.firstName, 'Ernestina');
    assert.equal(rows[3]?.payload.lastName, 'Example');
    assert.equal(rows[3]?.payload.addressLine1, '2 Demo Road, Richmond');
    assert.equal(rows[3]?.payload.postcode, 'TW10 7LR');
    assert.equal(rows[3]?.payload.assignedAdviserEmail, undefined);
  });

  it('parses a Clienttree address with an empty middle part', () => {
    assert.deepEqual(parseImportAddress('1 Baxter Place, , IV30 8QE'), {
      line1: '1 Baxter Place',
      postcode: 'IV30 8QE',
    });
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
