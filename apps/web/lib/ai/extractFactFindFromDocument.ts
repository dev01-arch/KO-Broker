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

const SYSTEM_PROMPT = `You are an expert UK mortgage fact-find data extraction assistant.
Extract ONLY information explicitly present in the uploaded document.
Never invent, assume, or guess values. Omit fields you cannot confidently read.
Return valid JSON only — no markdown fences or commentary.

Use British English formatting for dates (DD/MM/YYYY) and currency (£).
For monetary amounts, return plain numbers without currency symbols or commas (e.g. 52000 not £52,000).
For employment status use one of: EMPLOYED, SELF_EMPLOYED, CONTRACTOR, RETIRED, UNEMPLOYED.
For marital status use: Single, Married, Civil partnership, Divorced, Widowed.
For yes/no fact-find questions use exactly "Yes" or "No".

Name parsing: split full names into firstName, middleName (if present), lastName.
Address parsing: put street into line1, town/city into city, UK postcode into postcode.
National Insurance numbers: preserve spacing as shown or use standard format (e.g. CD 98 76 54 B).

Credit reports (Experian, Equifax, TransUnion): map personal details, employment, income,
existing mortgage accounts, credit cards, loans, missed payments, CCJs/defaults, and broker notes.
If the document indicates remortgage intent, set caseType to "REMORTGAGE" and hasExistingMortgage to true.`;

const USER_PROMPT = `Extract mortgage fact-find fields from this document.
Document category hint: {category}

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
}

Guidance by document type:
- Credit report: populate adverse credit fields, creditCards, loans, existing mortgage from account history.
- Payslip: focus on client1Income and client1Employment.
- Bank statement: focus on income and expenditure patterns if stated.
- ID document: focus on client1Personal only.`;

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
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error(`Unsupported file type: ${input.mimeType}`);
  }

  const category = input.documentCategory?.trim() || 'Other / general';
  const pdfText =
    input.mimeType === 'application/pdf' ? await extractPdfText(input.buffer) : undefined;
  const documentContent = buildDocumentContent(
    input.buffer,
    input.filename,
    input.mimeType,
    pdfText,
  );
  const usesFilePlugin = input.mimeType === 'application/pdf' && !pdfText;

  const raw = await openRouterChatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          ...documentContent,
          {
            type: 'text',
            text: USER_PROMPT.replace('{category}', category),
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
