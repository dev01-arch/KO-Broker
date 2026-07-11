/**
 * Maps the live-demo / portal wizard form state into UpsertFactFindInput
 * section JSON expected by PUT /api/cases/:id/fact-find and portal fact-find routes.
 */

export type FactFindFormState = Record<string, unknown>;

const VULN_DOMAINS = [
  'mentalHealth',
  'physicalHealth',
  'financialDifficulty',
  'lifeEvents',
  'resilience',
  'digitalCapability',
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapVulnerabilityAnswers(scores: unknown): Record<string, number[]> {
  if (!Array.isArray(scores)) return {};
  const answers: Record<string, number[]> = {};
  VULN_DOMAINS.forEach((domain, index) => {
    const entry = asRecord(scores[index]);
    const q1 = typeof entry.q1 === 'number' && entry.q1 >= 0 ? entry.q1 : 0;
    const q2 = typeof entry.q2 === 'number' && entry.q2 >= 0 ? entry.q2 : 0;
    answers[domain] = [q1, q2];
  });
  return answers;
}

export interface SerializeFactFindOptions {
  markComplete?: boolean;
}

/**
 * Serialize wizard form → API upsert payload.
 * Keeps `personalDetails.portalFactFindForm` for round-trip hydration in the live demo.
 */
export function serializeFactFindForm(
  form: FactFindFormState,
  options: SerializeFactFindOptions = {},
) {
  const client1Personal = asRecord(form.client1Personal);
  const client2Personal = asRecord(form.client2Personal);
  const client1Employment = asRecord(form.client1Employment);
  const client2Employment = asRecord(form.client2Employment);
  const client1Income = asRecord(form.client1Income);
  const client2Income = asRecord(form.client2Income);
  const hasJoint = Boolean(form.hasJointApplicant);

  const personalDetails: Record<string, unknown> = {
    portalFactFindForm: form,
    caseType: form.caseType,
    hasJointApplicant: hasJoint,
    title: client1Personal.title,
    firstName: client1Personal.firstName,
    middleName: client1Personal.middleName,
    lastName: client1Personal.lastName,
    dateOfBirth: client1Personal.dob,
    nationality: client1Personal.nationality,
    maritalStatus: client1Personal.maritalStatus,
    phone: client1Personal.contactNumber,
    email: client1Personal.email,
    currentAddress: client1Personal.currentAddress,
    previousAddress: client1Personal.previousAddress,
    dependants: client1Personal.dependants,
    client1: client1Personal,
    ...(hasJoint ? { client2: client2Personal } : {}),
    adverseCredit: {
      client1MissedPayments: form.client1MissedPayments,
      client1MissedPaymentsDetail: form.client1MissedPaymentsDetail,
      client1CCJ: form.client1CCJ,
      client1CCJDetail: form.client1CCJDetail,
      ...(hasJoint
        ? {
            client2MissedPayments: form.client2MissedPayments,
            client2MissedPaymentsDetail: form.client2MissedPaymentsDetail,
            client2CCJ: form.client2CCJ,
            client2CCJDetail: form.client2CCJDetail,
          }
        : {}),
    },
  };

  const employmentDetails: Record<string, unknown> = {
    client1: client1Employment,
    employmentStatus: client1Employment.employmentStatus,
    employerName: client1Employment.employerName,
    ...(hasJoint ? { client2: client2Employment } : {}),
  };

  const incomeDetails: Record<string, unknown> = {
    client1: client1Income,
    grossSalary: client1Income.grossSalary,
    annualIncome: client1Income.grossSalary,
    bonusAmount: client1Income.bonusAmount,
    ...(hasJoint ? { client2: client2Income } : {}),
  };

  const expenditureDetails: Record<string, unknown> = {
    creditCards: form.creditCards,
    loans: form.loans,
    insurancePolicies: form.insurancePolicies,
  };

  const propertyDetails: Record<string, unknown> = {
    propertyToggle: form.propertyToggle,
    propertyValue: form.propertyValue,
    value: form.propertyValue,
    mortgageRequired: form.mortgageRequired,
    loanAmount: form.mortgageRequired,
    depositSource: form.depositSource,
    termRequired: form.termRequired,
    repaymentType: form.repaymentType,
    propertyType: form.propertyType,
    tenure: form.tenure,
    intendedUse: form.intendedUse,
    purposeOfLoan: form.purposeOfLoan,
    leaseholdYearsRemaining: form.leaseholdYearsRemaining,
    rentalIncome: form.rentalIncomeStep5,
  };

  const existingMortgages: Record<string, unknown> = form.hasExistingMortgage
    ? {
        hasExistingMortgage: true,
        lenderName: form.existingMortgageLender,
        accountNumber: form.existingMortgageAccountNo,
        balance: form.existingMortgageBalance,
        monthlyPayment: form.existingMortgageMonthly,
        rate: form.existingMortgageRate,
        productEndDate: form.existingMortgageProductEnd,
        erc: form.existingMortgageERC,
        ercUntil: form.existingMortgageERCUntil,
      }
    : { hasExistingMortgage: false };

  const vulnerabilityAnswers = mapVulnerabilityAnswers(form.vulnerabilityScores);

  const clientPreferences: Record<string, unknown> = {
    goals: form.goals,
    futureChanges: form.futureChanges,
    whatMatters: form.whatMatters,
    ratePreference: form.ratePreference,
    initialPeriod: form.initialPeriod,
    maxMonthlyPayment: form.maxMonthlyPayment,
    riskAppetite: form.riskAppetite,
    adviserNotes: form.adviserNotes,
    vulnerabilityScores: form.vulnerabilityScores,
    vulnerabilityAnswers,
    vulnerabilityOverride: form.vulnerabilityOverride,
    vulnerabilityOverrideJustification: form.vulnerabilityOverrideJustification,
  };

  return {
    personalDetails,
    employmentDetails,
    incomeDetails,
    expenditureDetails,
    propertyDetails,
    existingMortgages,
    clientPreferences,
    ...(options.markComplete ? { markComplete: true as const } : {}),
  };
}

/**
 * If the payload only carries the wizard blob, expand it into full section JSON.
 * Otherwise return the payload unchanged (already section-shaped).
 */
export function expandFactFindUpsertPayload(payload: {
  personalDetails?: Record<string, unknown>;
  employmentDetails?: Record<string, unknown>;
  incomeDetails?: Record<string, unknown>;
  expenditureDetails?: Record<string, unknown>;
  propertyDetails?: Record<string, unknown>;
  existingMortgages?: Record<string, unknown>;
  clientPreferences?: Record<string, unknown>;
  markComplete?: boolean;
}) {
  const formBlob = payload.personalDetails?.portalFactFindForm;
  if (formBlob && typeof formBlob === 'object' && !Array.isArray(formBlob)) {
    return serializeFactFindForm(formBlob as FactFindFormState, {
      markComplete: payload.markComplete,
    });
  }
  return payload;
}
