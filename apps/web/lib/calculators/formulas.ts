/**
 * Shared mortgage calculator / intelligence formulas (PRD-11 + PRD-15 §6.3).
 * Pure functions only — no side effects, no API calls.
 * Backend snapshot POST imports these; do not reimplement amortisation elsewhere.
 */

export type MarketSignalLabel = 'Improving' | 'Stable' | 'Worsening';

export type LtvBandResult = {
  band: 'mainstream' | 'higher';
  referenceLtv: number;
  pointsAboveReference: number;
  positionLabel: string;
};

export type DtiResult = {
  /** Monthly commitments / monthly gross income, as a percentage. */
  dtiPct: number;
  band: 'healthy' | 'moderate' | 'watch';
  watch: boolean;
};

export type RateLadderRung = {
  ratePct: number;
  monthlyPayment: number;
  isBenchmark: boolean;
};

/** Loan-to-value as a percentage (0–100+). */
export function ltv(loanAmount: number, propertyValue: number): number {
  if (!Number.isFinite(loanAmount) || !Number.isFinite(propertyValue) || propertyValue <= 0) {
    return 0;
  }
  return (loanAmount / propertyValue) * 100;
}

/** Loan-to-income multiple. */
export function loanToIncome(loanAmount: number, grossAnnualIncome: number): number {
  if (
    !Number.isFinite(loanAmount) ||
    !Number.isFinite(grossAnnualIncome) ||
    grossAnnualIncome <= 0
  ) {
    return 0;
  }
  return loanAmount / grossAnnualIncome;
}

/**
 * Standard repayment (capital + interest) monthly payment.
 * `annualRatePct` is e.g. 4.1 for 4.1%.
 */
export function monthlyPaymentRepayment(
  principal: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(termYears) || termYears <= 0) return 0;
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) return 0;

  const monthlyRate = annualRatePct / 100 / 12;
  const numPayments = termYears * 12;
  if (monthlyRate === 0) return principal / numPayments;

  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (principal * (monthlyRate * factor)) / (factor - 1);
}

/** Interest-only monthly payment. */
export function monthlyPaymentInterestOnly(principal: number, annualRatePct: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) return 0;
  return (principal * (annualRatePct / 100)) / 12;
}

/**
 * Rate sensitivity ladder centred on `centreRatePct` with ±0.5 and ±1.0 steps.
 */
export function rateSensitivityLadder(
  principal: number,
  termYears: number,
  centreRatePct: number,
  offsets: number[] = [-1, -0.5, 0, 0.5, 1],
): RateLadderRung[] {
  return offsets.map((offset) => {
    const ratePct = Math.round((centreRatePct + offset) * 100) / 100;
    return {
      ratePct,
      monthlyPayment: monthlyPaymentRepayment(principal, ratePct, termYears),
      isBenchmark: offset === 0,
    };
  });
}

/** Property vs local median: percent difference. */
export function vsLocalMedian(propertyValue: number, localMedian: number): number {
  if (!Number.isFinite(propertyValue) || !Number.isFinite(localMedian) || localMedian <= 0) {
    return 0;
  }
  return ((propertyValue - localMedian) / localMedian) * 100;
}

/** Rate change in basis points (current − prior). Negative = rates fell. */
export function rateTrendBps(currentRatePct: number, priorRatePct: number): number {
  if (!Number.isFinite(currentRatePct) || !Number.isFinite(priorRatePct)) return 0;
  return Math.round((currentRatePct - priorRatePct) * 100);
}

/**
 * Debt-to-income: annual commitments / gross annual income as %.
 * Watch if ≥ 40%.
 */
export function dti(monthlyCommitments: number, grossAnnualIncome: number): DtiResult {
  if (
    !Number.isFinite(monthlyCommitments) ||
    !Number.isFinite(grossAnnualIncome) ||
    grossAnnualIncome <= 0
  ) {
    return { dtiPct: 0, band: 'healthy', watch: false };
  }
  const dtiPct = ((monthlyCommitments * 12) / grossAnnualIncome) * 100;
  const watch = dtiPct >= 40;
  const band: DtiResult['band'] = watch ? 'watch' : dtiPct < 15 ? 'healthy' : 'moderate';
  return { dtiPct, band, watch };
}

/**
 * LTV band vs BoE 75% reference. Higher if LTV > 90.
 */
export function ltvBand(applicantLtvPct: number): LtvBandResult {
  const referenceLtv = 75;
  const pointsAboveReference = applicantLtvPct - referenceLtv;
  const band: LtvBandResult['band'] = applicantLtvPct > 90 ? 'higher' : 'mainstream';
  const positionLabel =
    pointsAboveReference === 0
      ? 'At mainstream band'
      : pointsAboveReference > 0
        ? `${pointsAboveReference.toFixed(0)}pts above mainstream band`
        : `${Math.abs(pointsAboveReference).toFixed(0)}pts below mainstream band`;
  return { band, referenceLtv, pointsAboveReference, positionLabel };
}

/**
 * Market signal from 12m change in 2yr and 5yr quoted rates (bps).
 * Improving if both ≤ −25bps; Worsening if both ≥ +25bps; else Stable.
 */
export function marketSignal(
  change2yrBps: number | null | undefined,
  change5yrBps: number | null | undefined,
): MarketSignalLabel | null {
  if (
    change2yrBps == null ||
    change5yrBps == null ||
    !Number.isFinite(change2yrBps) ||
    !Number.isFinite(change5yrBps)
  ) {
    return null;
  }
  if (change2yrBps <= -25 && change5yrBps <= -25) return 'Improving';
  if (change2yrBps >= 25 && change5yrBps >= 25) return 'Worsening';
  return 'Stable';
}

/** Affordability max borrowing from income × multiplier. */
export function maxBorrowing(
  annualIncome: number,
  secondIncome: number,
  multiplier: number,
): number {
  return (annualIncome + secondIncome) * multiplier;
}

export function maxPurchasePrice(borrowing: number, deposit: number): number {
  return borrowing + deposit;
}

/** Equity from property value − loan. */
export function equityAmount(propertyValue: number, loanAmount: number): number {
  return propertyValue - loanAmount;
}

export function earlyRepaymentCharge(outstandingBalance: number, ercPercentage: number): number {
  return outstandingBalance * (ercPercentage / 100);
}

export function rentalYields(
  propertyPrice: number,
  monthlyRent: number,
  annualCosts: number,
  mortgageBalance: number,
  interestRatePct = 0,
): { grossYield: number; netYield: number; cashOnCashReturn: number; netIncome: number } {
  if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) {
    return { grossYield: 0, netYield: 0, cashOnCashReturn: 0, netIncome: 0 };
  }
  const annualRent = monthlyRent * 12;
  const annualInterest = mortgageBalance * (interestRatePct / 100);
  const netIncome = annualRent - annualCosts - annualInterest;
  const equity = propertyPrice - mortgageBalance;
  return {
    grossYield: (annualRent / propertyPrice) * 100,
    netYield: (netIncome / propertyPrice) * 100,
    cashOnCashReturn: equity > 0 ? (netIncome / equity) * 100 : 0,
    netIncome,
  };
}

/** UK residential SDLT (England/NI standard bands used by existing calculator). */
export function stampDuty(
  propertyPrice: number,
  options: { firstTimeBuyer?: boolean; additionalProperty?: boolean } = {},
): number {
  const { firstTimeBuyer = false, additionalProperty = false } = options;
  let duty = 0;

  if (additionalProperty) {
    const surcharge = propertyPrice * 0.03;
    if (propertyPrice > 1_500_000) {
      duty += (propertyPrice - 1_500_000) * 0.12;
      duty += (1_500_000 - 925_000) * 0.1;
      duty += (925_000 - 250_000) * 0.05;
    } else if (propertyPrice > 925_000) {
      duty += (propertyPrice - 925_000) * 0.1;
      duty += (925_000 - 250_000) * 0.05;
    } else if (propertyPrice > 250_000) {
      duty += (propertyPrice - 250_000) * 0.05;
    }
    duty += surcharge;
  } else if (firstTimeBuyer && propertyPrice <= 625_000) {
    if (propertyPrice > 425_000) {
      duty = (propertyPrice - 425_000) * 0.05;
    }
  } else if (propertyPrice > 1_500_000) {
    duty += (propertyPrice - 1_500_000) * 0.12;
    duty += (1_500_000 - 925_000) * 0.1;
    duty += (925_000 - 250_000) * 0.05;
  } else if (propertyPrice > 925_000) {
    duty += (propertyPrice - 925_000) * 0.1;
    duty += (925_000 - 250_000) * 0.05;
  } else if (propertyPrice > 250_000) {
    duty += (propertyPrice - 250_000) * 0.05;
  }

  return duty;
}

export function remortgageSaving(
  currentBalance: number,
  currentRatePct: number,
  newRatePct: number,
  remainingTermYears: number,
  fees: number,
): {
  currentPayment: number;
  newPayment: number;
  monthlySaving: number;
  annualSaving: number;
  breakEvenMonths: number;
} {
  const currentPayment = monthlyPaymentRepayment(
    currentBalance,
    currentRatePct,
    remainingTermYears,
  );
  const newPayment = monthlyPaymentRepayment(currentBalance, newRatePct, remainingTermYears);
  const monthlySaving = currentPayment - newPayment;
  return {
    currentPayment,
    newPayment,
    monthlySaving,
    annualSaving: monthlySaving * 12,
    breakEvenMonths: monthlySaving > 0 ? fees / monthlySaving : Infinity,
  };
}

export function debtConsolidationSummary(
  debts: { amount: number; ratePct: number; termYears?: number }[],
  consolidationRatePct: number,
  consolidationTermYears: number,
): {
  totalDebt: number;
  weightedRate: number;
  totalCurrentPayment: number;
  consolidatedPayment: number;
  monthlySaving: number;
  annualSaving: number;
} {
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0);
  const weightedRate =
    totalDebt > 0
      ? debts.reduce((s, d) => s + d.amount * d.ratePct, 0) / totalDebt
      : 0;
  const totalCurrentPayment = debts.reduce(
    (s, d) => s + monthlyPaymentRepayment(d.amount, d.ratePct, d.termYears ?? 3),
    0,
  );
  const consolidatedPayment = monthlyPaymentRepayment(
    totalDebt,
    consolidationRatePct,
    consolidationTermYears,
  );
  const monthlySaving = totalCurrentPayment - consolidatedPayment;
  return {
    totalDebt,
    weightedRate,
    totalCurrentPayment,
    consolidatedPayment,
    monthlySaving,
    annualSaving: monthlySaving * 12,
  };
}
