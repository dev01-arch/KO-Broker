/**
 * Case preview assembler — PRD-15 B6
 *
 * Stitches together Case + Client + FactFind into the { value, present }
 * shape the confirm box needs. Missing data → present: false, never £0.
 *
 * Field sourcing (per PRD-15 §B6 and serializeFactFindForm.ts field names):
 *
 *   postcode          → factFind.propertyDetails (no dedicated field; check
 *                        personalDetails.currentAddress or client.address JSON)
 *   propertyValue     → case.propertyValue
 *   mortgageAmount    → case.loanAmount
 *   termYears         → case.termYears
 *   deposit           → propertyValue − loanAmount (if both set), else absent
 *   grossIncome       → client.annualIncome → factFind.incomeDetails.grossSalary
 *   monthlyCommitments→ factFind.expenditureDetails (sum of monthly credit obligations)
 */

import { prisma } from '@/lib/db';
import type { CasePreviewResponse, PresenceField } from '@ko/types';

// ── Internal helpers ──────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toFloat(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  return null;
}

function field<T>(value: T | null | undefined): PresenceField<T> {
  if (value === null || value === undefined) return { value: null, present: false };
  return { value, present: true };
}

/**
 * Try to extract a postcode string from the FactFind/Client address blobs.
 *
 * propertyDetails has no dedicated postcode field — postcode lives in
 * personalDetails.currentAddress (a free-form address object from the wizard)
 * or on client.address (also JSON).
 */
function extractPostcode(
  personalDetails: Record<string, unknown>,
  clientAddress: unknown,
): string | null {
  // Try personalDetails.currentAddress.postcode first
  const currentAddress = asRecord(personalDetails.currentAddress);
  const pc1 =
    typeof currentAddress.postcode === 'string' ? currentAddress.postcode.trim() : null;
  if (pc1) return pc1;

  // Try client.address.postcode
  const addrRecord = asRecord(clientAddress);
  const pc2 = typeof addrRecord.postcode === 'string' ? addrRecord.postcode.trim() : null;
  if (pc2) return pc2;

  return null;
}

/**
 * Sum monthly commitments from expenditureDetails.
 *
 * The wizard stores these as arrays of objects with a `monthlyPayment` field.
 * expenditureDetails: { creditCards: [...], loans: [...], insurancePolicies: [...] }
 */
function sumMonthlyCommitments(expenditureDetails: Record<string, unknown>): number | null {
  let total = 0;
  let hasAny = false;

  const categories = ['creditCards', 'loans', 'insurancePolicies'] as const;
  for (const cat of categories) {
    const items = expenditureDetails[cat];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const rec = asRecord(item);
      const monthly =
        toFloat(rec.monthlyPayment) ??
        toFloat(rec.monthly) ??
        toFloat(rec.payment) ??
        null;
      if (monthly !== null) {
        total += monthly;
        hasAny = true;
      }
    }
  }

  return hasAny ? total : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CasePreviewAssemblyResult {
  preview: CasePreviewResponse;
  /** Canonical label used in the confirm box mode note */
  caseLabel: string;
}

/**
 * Assemble a case preview from Case + Client + FactFind.
 * Returns null if the case is not found (caller returns 404).
 */
export async function assembleCasePreview(
  caseId: string,
  orgId: string,
): Promise<CasePreviewAssemblyResult | null> {
  const caseRow = await prisma.case.findFirst({
    where: { id: caseId, orgId },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          referenceNumber: true,
          annualIncome: true,
          address: true,
        },
      },
      factFind: {
        select: {
          personalDetails: true,
          incomeDetails: true,
          expenditureDetails: true,
          propertyDetails: true,
        },
      },
    },
  });

  if (!caseRow) return null;

  const { client, factFind } = caseRow;

  // ── FactFind JSON sections ─────────────────────────────────────────────────
  const personalDetails = asRecord(factFind?.personalDetails);
  const incomeDetails = asRecord(factFind?.incomeDetails);
  const expenditureDetails = asRecord(factFind?.expenditureDetails);

  // ── Case label ─────────────────────────────────────────────────────────────
  const clientName =
    [client.firstName, client.lastName].filter(Boolean).join(' ') ||
    client.referenceNumber;
  const caseLabel = `${caseRow.referenceNumber} — ${clientName}`;

  // ── postcode ───────────────────────────────────────────────────────────────
  const postcodeValue = extractPostcode(personalDetails, client.address);

  // ── propertyValue ──────────────────────────────────────────────────────────
  const propertyValue = caseRow.propertyValue ?? null;

  // ── mortgageAmount (loanAmount on Case) ───────────────────────────────────
  const mortgageAmount = caseRow.loanAmount ?? null;

  // ── termYears ──────────────────────────────────────────────────────────────
  const termYears = caseRow.termYears ?? null;

  // ── deposit = propertyValue − loanAmount (if both present) ────────────────
  let depositValue: number | null = null;
  if (propertyValue !== null && mortgageAmount !== null) {
    depositValue = propertyValue - mortgageAmount;
    if (depositValue < 0) depositValue = null; // nonsensical — omit
  }

  // ── grossIncome → client.annualIncome → factFind incomeDetails ────────────
  let grossIncome: number | null = toFloat(client.annualIncome);
  if (grossIncome === null) {
    grossIncome =
      toFloat(incomeDetails.grossSalary) ?? toFloat(incomeDetails.annualIncome) ?? null;
  }

  // ── monthlyCommitments from expenditureDetails ────────────────────────────
  const monthlyCommitments = sumMonthlyCommitments(expenditureDetails);

  const preview: CasePreviewResponse = {
    caseLabel,
    postcode: field(postcodeValue),
    propertyValue: field(propertyValue),
    deposit: field(depositValue),
    mortgageAmount: field(mortgageAmount),
    termYears: field(termYears),
    grossIncome: field(grossIncome),
    monthlyCommitments: field(monthlyCommitments),
  };

  return { preview, caseLabel };
}
