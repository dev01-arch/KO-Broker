export type IllustrationSection = {
  heading: string;
  lines: string[];
};

export type EsisProductInput = {
  firmName: string;
  adviserName: string;
  clientName: string;
  referenceNumber: string;
  generatedOn: string;
  loanAmount: number | null;
  propertyValue: number | null;
  termYears: number | null;
  lenderName: string | null;
  productName: string | null;
  rate: number | null;
  fee: number | null;
  monthlyPayment: number | null;
  rateType: string | null;
  initialTermMonths: number | null;
  ercSummary: string | null;
};

export type ResearchProductInput = {
  lenderName: string;
  productName: string;
  rate: number | null;
  fee: number | null;
  isSelected: boolean;
  reasonNotSelected: string | null;
};

export type ResearchPackInput = {
  firmName: string;
  clientName: string;
  referenceNumber: string;
  generatedOn: string;
  products: ResearchProductInput[];
};

const MISSING = 'Not on the case yet.';

function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
}

function rateLabel(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return MISSING;
  return `${value}%`;
}

/** Standard repayment instalment from amount, annual rate, and term. */
export function repaymentInstalment(
  loan: number | null,
  annualRatePct: number | null,
  termYears: number | null,
): number | null {
  if (loan == null || annualRatePct == null || termYears == null) return null;
  if (!(loan > 0) || !(termYears > 0) || !(annualRatePct >= 0)) return null;
  const months = Math.round(termYears * 12);
  if (months <= 0) return null;
  if (annualRatePct === 0) return loan / months;
  const monthlyRate = annualRatePct / 100 / 12;
  const factor = (1 + monthlyRate) ** months;
  return (loan * monthlyRate * factor) / (factor - 1);
}

function instalmentLine(input: EsisProductInput): { amount: number | null; line: string } {
  if (input.monthlyPayment != null && Number.isFinite(input.monthlyPayment)) {
    return { amount: input.monthlyPayment, line: `${money(input.monthlyPayment)} a month, as recorded on the case.` };
  }
  const calculated = repaymentInstalment(input.loanAmount, input.rate, input.termYears);
  if (calculated == null) return { amount: null, line: MISSING };
  return {
    amount: calculated,
    line: `${money(calculated)} a month, calculated from the loan amount, rate, and term on this case.`,
  };
}

export function repaymentTableLines(input: EsisProductInput, instalment: number | null): string[] {
  if (
    instalment == null ||
    input.loanAmount == null ||
    input.rate == null ||
    input.termYears == null ||
    !(input.loanAmount > 0) ||
    !(input.termYears > 0)
  ) {
    return [MISSING];
  }
  const months = Math.round(input.termYears * 12);
  const monthlyRate = input.rate / 100 / 12;
  let balance = input.loanAmount;
  const lines: string[] = [];
  const years = Math.min(Math.ceil(months / 12), 30);
  for (let year = 1; year <= years; year += 1) {
    let interestPaid = 0;
    let capitalPaid = 0;
    const monthsThisYear = Math.min(12, months - (year - 1) * 12);
    for (let month = 0; month < monthsThisYear; month += 1) {
      const interest = balance * monthlyRate;
      const capital = Math.min(balance, Math.max(0, instalment - interest));
      interestPaid += interest;
      capitalPaid += capital;
      balance = Math.max(0, balance - capital);
    }
    lines.push(
      `Year ${year}: capital ${money(capitalPaid)}, interest ${money(interestPaid)}, balance ${money(balance)}.`,
    );
    if (balance <= 0) break;
  }
  return lines;
}

export function buildEsisSections(input: EsisProductInput): { ok: true; sections: IllustrationSection[] } | { ok: false; message: string } {
  if (!input.lenderName && !input.productName) {
    return { ok: false, message: 'Select the recommended product before generating the ESIS.' };
  }
  const instalment = instalmentLine(input);
  const stressed = repaymentInstalment(
    input.loanAmount,
    input.rate == null ? null : input.rate + 2,
    input.termYears,
  );
  const productLabel = [input.lenderName, input.productName].filter(Boolean).join(' — ');
  const sections: IllustrationSection[] = [
    {
      heading: 'Introduction',
      lines: [
        `Prepared for ${input.clientName} on ${input.generatedOn}. Case ${input.referenceNumber}.`,
        'This European Standardised Information Sheet describes the recommended mortgage recorded on this case.',
        'It is an illustration, valid on the date above, and it is not a mortgage offer.',
        'A figure that is not recorded on the case is left blank. It is not estimated.',
      ],
    },
    {
      heading: '1. Lender',
      lines: [input.lenderName || MISSING, input.productName ? `Product: ${input.productName}` : MISSING],
    },
    {
      heading: '2. Credit intermediary',
      lines: [
        input.firmName,
        input.adviserName ? `Adviser: ${input.adviserName}` : 'Adviser: not recorded.',
        'We recommend a mortgage after assessing your needs and circumstances. Our regulatory status is set out in the initial disclosure sent when the case was established.',
      ],
    },
    {
      heading: '3. Main features of the loan',
      lines: [
        `Amount: ${money(input.loanAmount)}`,
        `Property value: ${money(input.propertyValue)}`,
        `Term: ${input.termYears != null ? `${input.termYears} years` : MISSING}`,
        `Rate type: ${input.rateType || MISSING}`,
        `Initial period: ${input.initialTermMonths != null ? `${input.initialTermMonths} months` : MISSING}`,
        `Product: ${productLabel}`,
      ],
    },
    {
      heading: '4. Interest rate and other costs',
      lines: [
        `Interest rate: ${rateLabel(input.rate)}`,
        `Product fee: ${input.fee != null ? money(input.fee) : MISSING}`,
        'APRC: Not on the case yet. Use the lender figure when it is supplied.',
      ],
    },
    {
      heading: '5. Frequency and number of payments',
      lines: [
        'Payments are monthly.',
        input.termYears != null ? `Number of monthly payments: ${Math.round(input.termYears * 12)}.` : MISSING,
      ],
    },
    {
      heading: '6. Amount of each instalment',
      lines: [instalment.line],
    },
    {
      heading: '7. Illustrative repayment table',
      lines: repaymentTableLines(input, instalment.amount),
    },
    {
      heading: '8. Additional obligations',
      lines: [
        'You will need buildings insurance for the property.',
        'Any linked insurance is arranged only where you agree to it. None is added by this illustration.',
      ],
    },
    {
      heading: '9. Early repayment',
      lines: [
        input.ercSummary || MISSING,
        'Paying the loan off early can incur a charge. The lender confirmation is the binding figure.',
      ],
    },
    {
      heading: '10. Flexible features',
      lines: ['Overpayments, portability, and payment holidays depend on the lender product. They are not assumed here unless noted in the early-repayment summary above.'],
    },
    {
      heading: '11. Other rights of the borrower',
      lines: ['You can ask for time to consider this illustration before you apply. Where a reflection period applies, the lender will confirm it.'],
    },
    {
      heading: '12. Complaints',
      lines: [
        `Complaints should be raised with ${input.firmName} first.`,
        'If you remain dissatisfied you can refer the complaint to the Financial Ombudsman Service.',
      ],
    },
    {
      heading: '13. Non-compliance',
      lines: ['If you miss payments the lender can charge arrears costs and, in serious cases, take steps to recover the property. The lender will set out the consequences in the offer.'],
    },
    {
      heading: '14. Additional information',
      lines: ['This illustration is prepared under the law of England and Wales unless the lender states otherwise. It does not replace the mortgage offer or the draft agreement.'],
    },
    {
      heading: '15. Supervisor',
      lines: [
        `${input.firmName} is authorised and regulated by the Financial Conduct Authority.`,
        'The Financial Conduct Authority supervises mortgage lending and advice. The Financial Ombudsman Service deals with unresolved complaints.',
      ],
    },
    {
      heading: 'If the rate were 2 percentage points higher',
      lines: [
        stressed == null
          ? MISSING
          : `${money(stressed)} a month, calculated from the same amount and term at the recorded rate plus 2 percentage points. This is an illustration, not a forecast.`,
      ],
    },
  ];
  return { ok: true, sections };
}

export function buildResearchSections(
  input: ResearchPackInput,
): { ok: true; sections: IllustrationSection[] } | { ok: false; message: string } {
  if (input.products.length === 0) {
    return { ok: false, message: 'Record a product on Research before generating the research pack.' };
  }
  const lines = input.products.map((product, index) => {
    const name = [product.lenderName, product.productName].filter(Boolean).join(' — ') || 'Product';
    const recommendation = product.isSelected ? 'Recommended.' : 'Not recommended.';
    const reason = product.isSelected ? '' : ` ${product.reasonNotSelected || 'No reason recorded.'}`;
    return `${index + 1}. ${name}. Rate ${rateLabel(product.rate)}. Fee ${product.fee != null ? money(product.fee) : MISSING} ${recommendation}${reason}`;
  });
  return {
    ok: true,
    sections: [
      {
        heading: 'Research pack',
        lines: [
          `Prepared for ${input.clientName} on ${input.generatedOn}. Case ${input.referenceNumber}.`,
          `${input.firmName} recorded these products while researching the case.`,
        ],
      },
      { heading: 'Products considered', lines },
    ],
  };
}
