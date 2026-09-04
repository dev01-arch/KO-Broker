import { openRouterChatCompletion, type OpenRouterMessageContent } from '@/lib/ai/openRouterClient';

/** Partial portal fact-find form fields returned by AI extraction. */
export type ExtractedFactFindForm = Record<string, unknown>;

export interface ExtractFactFindInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  documentCategory?: string;
}

export interface ExtractFactFindResult {
  extracted: ExtractedFactFindForm;
  fieldsFound: number;
  documentCategory?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/** Infer MIME from filename when the browser/OS leaves `file.type` empty. */
export function inferMimeTypeFromFilename(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase().trim();
  if (!ext) return undefined;
  return EXT_TO_MIME[ext];
}

export function resolveExtractMimeType(mimeType: string | undefined, filename: string): string {
  const raw = (mimeType || '').trim().toLowerCase();
  if (raw && raw !== 'application/octet-stream' && ALLOWED_MIME_TYPES.has(raw)) {
    return raw === 'image/jpg' ? 'image/jpeg' : raw;
  }
  const inferred = inferMimeTypeFromFilename(filename);
  if (inferred) return inferred;
  return raw || 'application/octet-stream';
}

function normalizeCategory(category?: string): string {
  return (category || 'Other / general').trim();
}

function categoryKey(category: string): string {
  return category.trim().toLowerCase();
}

/**
 * Per-category focus instructions. Keeps credit-report behaviour intact and
 * scopes other document types so the model does not invent unrelated fields.
 */
function categoryGuidance(category: string): string {
  switch (categoryKey(category)) {
    case 'personal details':
      return `Focus on identity / personal documents (passport, driving licence, utility bill, proof of address, photo ID).
Populate client1Personal only: name, DOB, nationality, contact details, marital status, dependants, current/previous addresses.
Do not invent employment, income, credit cards, loans, or property figures.`;
    case 'employment':
      return `Focus on employment evidence (contract, offer letter, P60 cover, employer confirmation letter, or photo of those).
Populate client1Employment: employmentStatus, employerName, employerAddress, employerTel, startDate, contractType, payslipFrequency.
Map status to one of: EMPLOYED_FT, EMPLOYED_PT, SELF_EMPLOYED_SOLE, SELF_EMPLOYED_LTD, PARTNERSHIP, CONTRACTOR, RETIRED, UNEMPLOYED.
Do not invent income amounts unless clearly printed on the document.`;
    case 'income':
      return `Focus on income evidence (payslip, SA302, tax computation, P60, dividend voucher, or photo of those).
Populate client1Income (and client1Employment employer name if shown): grossSalary, niNumber, bonusAmount, bonusFrequency, rentalIncome.
If the document is a monthly payslip, annualise only when the annual figure is explicitly stated; otherwise leave grossSalary as the stated period amount only if labelled as annual.
Do not invent credit commitments or adverse markers.`;
    case 'financial commitments':
      return `Focus on commitments (loan agreements, credit card statements, mortgage statements, HP agreements, or photos).
Populate creditCards[], loans[], and existing mortgage fields when present.
Do not invent personal identity fields beyond a name already clearly shown.`;
    case 'credit report':
      return `Credit reports (Experian, Equifax, TransUnion) — PDF or screenshot/photo:
Map personal details, employment, income, existing mortgage accounts, credit cards, loans, missed payments, CCJs/defaults, and broker notes.
If the document indicates remortgage intent, set caseType to "REMORTGAGE" and hasExistingMortgage to true.
Populate adverse credit fields, creditCards, loans, existing mortgage from account history.`;
    case 'property details':
      return `Focus on property / mortgage illustrations (valuation, ESIS, offer, particulars, or photos).
Populate propertyValue, mortgageRequired, depositSource, termRequired, caseType hints, intended use if stated.
Do not invent personal or employment history.`;
    case 'adverse credit':
      return `Focus on adverse credit evidence (defaults, CCJ certificates, IVA docs, arrears letters, or photos).
Populate client1MissedPayments / Detail and client1CCJ / Detail with Yes/No and concise detail from the document.
Also capture creditCards/loans if clearly listed. Do not invent clean credit where markers are shown.`;
    case 'goals & preferences':
      return `Focus on advice notes, client emails, or preference summaries.
Populate goals, whatMatters, and adviserNotes only when explicitly present. Do not invent scores or personal data.`;
    case 'vulnerability assessment':
      return `Focus only on explicitly stated vulnerability / Consumer Duty notes.
If the document does not contain vulnerability questionnaire answers, return {} (empty object).
Never invent vulnerabilityScores.`;
    default:
      return `General / unknown document: extract any clearly stated fact-find fields (personal, employment, income, commitments, property, adverse).
Prefer omitting uncertain fields. For photos of documents, read printed text carefully and ignore background clutter.`;
  }
}

const SYSTEM_PROMPT = `You are an expert UK mortgage fact-find data extraction assistant.
Extract ONLY information explicitly present in the uploaded document.
Never invent, assume, or guess values. Omit fields you cannot confidently read.
Return valid JSON only — no markdown fences or commentary.

Use British English formatting for dates (DD/MM/YYYY) and currency (£).
For monetary amounts, return plain numbers without currency symbols or commas (e.g. 52000 not £52,000).
For employment status use one of: EMPLOYED_FT, EMPLOYED_PT, SELF_EMPLOYED_SOLE, SELF_EMPLOYED_LTD, PARTNERSHIP, CONTRACTOR, RETIRED, UNEMPLOYED.
For marital status use: SINGLE, MARRIED, CIVIL_PARTNERSHIP, SEPARATED, DIVORCED, WIDOWED.
For yes/no fact-find questions use exactly "Yes" or "No".

Name parsing: split full names into firstName, middleName (if present), lastName.
Address parsing: put street into line1, town/city into city, UK postcode into postcode.
National Insurance numbers: preserve spacing as shown or use standard format (e.g. CD 98 76 54 B).

When the upload is an image (PNG/JPEG photo or screenshot of a document):
- Read all visible printed text; tolerate slight blur, tilt, and glare.
- Prefer fields you can read confidently; omit illegible values.
- Ignore phone UI chrome, hands, table surfaces, and unrelated background text.`;

const USER_PROMPT_TEMPLATE = `Extract mortgage fact-find fields from this document.
Document category hint: {category}

Category-specific guidance:
{categoryGuidance}

Return JSON with this exact shape (include only non-empty fields you found):
{
  "caseType": "",
  "hasExistingMortgage": false,
  "client1Personal": {
    "title": "",
    "firstName": "",
    "middleName": "",
    "lastName": "",
    "dob": "",
    "nationality": "",
    "contactNumber": "",
    "email": "",
    "maritalStatus": "",
    "financialDependantsCount": "",
    "currentAddress": { "line1": "", "line2": "", "city": "", "postcode": "" },
    "previousAddress": { "line1": "", "line2": "", "city": "", "postcode": "", "dateFrom": "" }
  },
  "client1Employment": {
    "employmentStatus": "",
    "employerName": "",
    "employerAddress": "",
    "employerTel": "",
    "startDate": "",
    "contractType": "",
    "payslipFrequency": ""
  },
  "client1Income": {
    "grossSalary": "",
    "niNumber": "",
    "bonusAmount": "",
    "bonusFrequency": "",
    "rentalIncome": ""
  },
  "creditCards": [
    { "id": "cc1", "limit": "", "balance": "", "monthlyPayment": "" }
  ],
  "loans": [
    { "id": "l1", "type": "", "balance": "", "monthlyPayment": "" }
  ],
  "existingMortgageLender": "",
  "existingMortgageBalance": "",
  "existingMortgageMonthly": "",
  "existingMortgageRate": "",
  "propertyValue": "",
  "mortgageRequired": "",
  "depositSource": "",
  "termRequired": "",
  "client1MissedPayments": "",
  "client1MissedPaymentsDetail": "",
  "client1CCJ": "",
  "client1CCJDetail": "",
  "goals": "",
  "whatMatters": "",
  "adviserNotes": ""
}`;

function buildDocumentContent(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  extractedText?: string,
): OpenRouterMessageContent[] {
  if (extractedText && extractedText.trim().length >= 80) {
    return [
      {
        type: 'text',
        text: `Document filename: ${filename}\n\n--- Document text ---\n${extractedText.trim()}\n--- End document text ---`,
      },
    ];
  }

  const base64 = buffer.toString('base64');

  if (mimeType === 'application/pdf') {
    return [
      {
        type: 'file',
        file: {
          filename,
          file_data: `data:application/pdf;base64,${base64}`,
        },
      },
    ];
  }

  const imageMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  return [
    {
      type: 'image_url',
      image_url: { url: `data:${imageMime};base64,${base64}` },
    },
  ];
}

async function extractPdfText(buffer: Buffer): Promise<string | undefined> {
  try {
    // Import the inner parser only — pdf-parse/index.js runs a debug harness at load time
    // that breaks under Next.js/Turbopack (!module.parent triggers a missing test file read).
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = (mod.default ?? mod) as (data: Buffer) => Promise<{ text?: string }>;
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.replace(/\s+/g, ' ').trim();
    return text && text.length >= 80 ? text : undefined;
  } catch {
    return undefined;
  }
}

function stripEmptyValues(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value)) {
    const cleaned = value.map(stripEmptyValues).filter((v) => v !== undefined);
    return cleaned.length ? cleaned : undefined;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, stripEmptyValues(v)] as const)
      .filter(([, v]) => v !== undefined);
    if (!entries.length) return undefined;
    return Object.fromEntries(entries);
  }
  return value;
}

function countLeafFields(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value !== 'object') return 1;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countLeafFields(item), 0);
  }
  return Object.values(value as Record<string, unknown>).reduce<number>(
    (sum, item) => sum + countLeafFields(item),
    0,
  );
}

function parseJsonResponse(raw: string): ExtractedFactFindForm {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI response did not contain valid JSON');
  }
  const parsed = JSON.parse(jsonMatch[0]) as ExtractedFactFindForm;
  const cleaned = stripEmptyValues(parsed);
  if (!cleaned || typeof cleaned !== 'object') {
    return {};
  }
  return cleaned as ExtractedFactFindForm;
}

export async function extractFactFindFromDocument(
  input: ExtractFactFindInput,
): Promise<ExtractFactFindResult> {
  const mimeType = resolveExtractMimeType(input.mimeType, input.filename);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType || mimeType}`);
  }

  const category = normalizeCategory(input.documentCategory);
  const pdfText = mimeType === 'application/pdf' ? await extractPdfText(input.buffer) : undefined;
  const documentContent = buildDocumentContent(
    input.buffer,
    input.filename,
    mimeType,
    pdfText,
  );
  const usesFilePlugin = mimeType === 'application/pdf' && !pdfText;
  const userPrompt = USER_PROMPT_TEMPLATE.replace('{category}', category).replace(
    '{categoryGuidance}',
    categoryGuidance(category),
  );

  const raw = await openRouterChatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          ...documentContent,
          {
            type: 'text',
            text: userPrompt,
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 4096,
    ...(usesFilePlugin
      ? { plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }] }
      : {}),
  });

  const extracted = parseJsonResponse(raw);
  return {
    extracted,
    fieldsFound: countLeafFields(extracted),
    documentCategory: category,
  };
}
