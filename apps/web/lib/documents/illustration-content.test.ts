import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildEsisSections, buildResearchSections, repaymentInstalment } from './illustration-content.ts';

const base = {
  firmName: 'KO Financials',
  adviserName: 'Alex Adviser',
  clientName: 'John Smith',
  referenceNumber: 'KOF-2026-0001',
  generatedOn: '2026-10-14',
  loanAmount: 240000,
  propertyValue: 300000,
  termYears: 25,
  lenderName: 'Example Lender',
  productName: '2 year fix',
  rate: 4.29,
  fee: 999,
  monthlyPayment: null,
  rateType: 'Fixed',
  initialTermMonths: 24,
  ercSummary: '3% until year 2',
};

describe('ESIS illustration', () => {
  it('requires a recommended product', () => {
    const result = buildEsisSections({ ...base, lenderName: null, productName: null });
    assert.equal(result.ok, false);
  });

  it('calculates the instalment from the recorded amount, rate, and term', () => {
    const payment = repaymentInstalment(240000, 4.29, 25);
    assert.ok(payment && payment > 1000 && payment < 2000);
    const result = buildEsisSections(base);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const instalment = result.sections.find((section) => section.heading.startsWith('6.'));
    assert.match(instalment?.lines[0] ?? '', /calculated from the loan amount, rate, and term/i);
    const aprc = result.sections.find((section) => section.heading.startsWith('4.'));
    assert.match(aprc?.lines.join(' ') ?? '', /Not on the case yet/);
  });

  it('leaves the instalment blank when the rate is missing', () => {
    const result = buildEsisSections({ ...base, rate: null, monthlyPayment: null });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const instalment = result.sections.find((section) => section.heading.startsWith('6.'));
    assert.equal(instalment?.lines[0], 'Not on the case yet.');
    const table = result.sections.find((section) => section.heading.startsWith('7.'));
    assert.equal(table?.lines[0], 'Not on the case yet.');
  });

  it('uses the monthly payment recorded on the case', () => {
    const result = buildEsisSections({ ...base, monthlyPayment: 1332.49 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const instalment = result.sections.find((section) => section.heading.startsWith('6.'));
    assert.match(instalment?.lines[0] ?? '', /1,332\.49/);
    assert.match(instalment?.lines[0] ?? '', /recorded on the case/);
  });
});

describe('research pack', () => {
  it('lists each recorded product and refuses an empty list', () => {
    assert.equal(buildResearchSections({
      firmName: 'KO Financials',
      clientName: 'John Smith',
      referenceNumber: 'KOF-2026-0001',
      generatedOn: '2026-10-14',
      products: [],
    }).ok, false);

    const result = buildResearchSections({
      firmName: 'KO Financials',
      clientName: 'John Smith',
      referenceNumber: 'KOF-2026-0001',
      generatedOn: '2026-10-14',
      products: [
        { lenderName: 'Example', productName: 'Fix', rate: 4.2, fee: 0, isSelected: true, reasonNotSelected: null },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.sections[1].lines[0], /Recommended/);
  });
});
