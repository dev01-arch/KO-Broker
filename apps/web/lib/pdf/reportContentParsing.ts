/** Content parsing helpers for suitability report PDF layout. */

export type ValueTiles = {
  propertyValue?: string;
  loanAmount?: string;
  ltv?: string;
};

export type ProductRow = {
  cells: string[];
  recommended: boolean;
};

export type ParsedSectionContent = {
  body: string;
  consumerDuty?: string;
  recommendation?: string;
  valueTiles?: ValueTiles;
  productRows?: ProductRow[];
  productHeaders?: string[];
  warningText?: string;
  outcomes?: Array<{ title: string; body: string }>;
};

const CONSUMER_DUTY_MARKERS = [
  /\n\s*(?:\*\*)?Consumer Duty (?:Evidence Statement|Evidencing Statement|Outcome[s]?)[:\s]*(?:\*\*)?\s*/i,
  /\n\s*(?:\*\*)?Consumer Duty[:\s]*(?:\*\*)?\s*/i,
];

const OUTCOME_TITLES = [
  'Products & Services',
  'Price & Value',
  'Consumer Understanding',
  'Consumer Support',
];

function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').trim();
}

export function splitConsumerDuty(content: string): { body: string; duty?: string } {
  for (const pattern of CONSUMER_DUTY_MARKERS) {
    const match = pattern.exec(content);
    if (match?.index !== undefined) {
      const body = content.slice(0, match.index).trim();
      const duty = content.slice(match.index + match[0].length).trim();
      if (duty) return { body, duty: stripBold(duty) };
    }
  }

  const paragraphs = content.split(/\n{2,}/);
  if (paragraphs.length > 1) {
    const last = paragraphs[paragraphs.length - 1];
    if (/consumer duty/i.test(last)) {
      return {
        body: paragraphs.slice(0, -1).join('\n\n').trim(),
        duty: stripBold(last),
      };
    }
  }

  return { body: content };
}

export function extractValueTiles(content: string): ValueTiles | undefined {
  const propertyValue =
    content.match(/property value[:\s]*£?\s*([\d,]+(?:\.\d{2})?)/i)?.[1] ??
    content.match(/£\s*([\d,]+)\s*(?:property|valuation)/i)?.[1];
  const loanAmount =
    content.match(/loan amount[:\s]*£?\s*([\d,]+(?:\.\d{2})?)/i)?.[1] ??
    content.match(/£\s*([\d,]+)\s*(?:loan|mortgage)/i)?.[1];
  const ltv =
    content.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:LTV|loan-to-value)/i)?.[1] ??
    content.match(/LTV[:\s]*(\d+(?:\.\d+)?)\s*%?/i)?.[1];

  if (!propertyValue && !loanAmount && !ltv) return undefined;

  return {
    propertyValue: propertyValue ? `£${propertyValue}` : undefined,
    loanAmount: loanAmount ? `£${loanAmount}` : undefined,
    ltv: ltv ? `${ltv}% LTV` : undefined,
  };
}

export function parseMarkdownTable(content: string): {
  headers: string[];
  rows: ProductRow[];
} | null {
  const lines = content.split('\n').filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split('|')
      .map((cell) => stripBold(cell.trim()))
      .filter((cell, idx, arr) => idx > 0 && idx < arr.length - 1);

  const headers = parseRow(lines[0]);
  const dataLines = lines.slice(1).filter((line) => !/^[\s|:-]+$/.test(line.replace(/\|/g, '')));

  if (headers.length === 0 || dataLines.length === 0) return null;

  const rows: ProductRow[] = dataLines.map((line) => {
    const cells = parseRow(line);
    const recommended =
      cells.some((cell) => /recommended/i.test(cell)) ||
      line.toLowerCase().includes('recommended');
    return { cells, recommended };
  });

  return { headers, rows };
}

export function extractRecommendation(content: string): string | undefined {
  const patterns = [
    /(?:\*\*)?Our (?:Recommended Solution|Recommendation)(?:\*\*)?[:\s]*\n?([\s\S]+?)(?:\n\n|$)/i,
    /(?:\*\*)?Recommendation(?:\*\*)?[:\s]*\n?([\s\S]+?)(?:\n\n|Consumer Duty)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match?.[1]?.trim()) return stripBold(match[1].trim());
  }
  return undefined;
}

export function extractWarningText(
  content: string,
  flagReason?: string | null,
): string | undefined {
  const gapMatch = content.match(
    /(?:\*\*)?(?:DATA GAP|Action Required)(?:\*\*)?[:\s-]*([\s\S]+?)(?:\n\n|Consumer Duty|$)/i,
  );
  if (gapMatch?.[1]?.trim()) return stripBold(gapMatch[1].trim());
  if (flagReason?.trim()) return flagReason.trim();
  if (/data gap|action required|missing/i.test(content)) {
    const paragraph = content
      .split(/\n{2,}/)
      .find((p) => /data gap|action required|missing/i.test(p));
    if (paragraph) return stripBold(paragraph);
  }
  return undefined;
}

export function extractOutcomes(content: string): Array<{ title: string; body: string }> | undefined {
  const outcomes: Array<{ title: string; body: string }> = [];

  for (const title of OUTCOME_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[:\\-]\\s*([^\n]+)`,
      'i',
    );
    const match = pattern.exec(content);
    if (match?.[1]?.trim()) {
      outcomes.push({ title, body: stripBold(match[1].trim()) });
    }
  }

  return outcomes.length >= 2 ? outcomes : undefined;
}

export function parseSectionContent(
  content: string,
  sectionId: string,
  sectionTitle: string,
  complianceFlag?: string,
  flagReason?: string | null,
): ParsedSectionContent {
  const { body: dutySplitBody, duty } = splitConsumerDuty(content);
  let body = dutySplitBody;

  const recommendation = extractRecommendation(body);
  if (recommendation) {
    body = body
      .replace(
        /(?:\*\*)?Our (?:Recommended Solution|Recommendation)(?:\*\*)?[:\s]*\n?[\s\S]+?(?:\n\n|$)/i,
        '',
      )
      .replace(/(?:\*\*)?Recommendation(?:\*\*)?[:\s]*\n?[\s\S]+?(?:\n\n|Consumer Duty)/i, '')
      .trim();
  }

  const table = parseMarkdownTable(body);
  if (table) {
    body = body.replace(/\|[^\n]+\|\n(?:\|[-:\s|]+\|\n)?(?:\|[^\n]+\|\n?)+/g, '').trim();
  }

  const warningText = extractWarningText(body, flagReason);
  if (warningText) {
    body = body
      .replace(
        /(?:\*\*)?(?:DATA GAP|Action Required)(?:\*\*)?[:\s-]*[\s\S]+?(?:\n\n|Consumer Duty|$)/i,
        '',
      )
      .trim();
  }

  const isRationale =
    /remortgage-rationale|rationale/i.test(sectionId) ||
    /rationale/i.test(sectionTitle);
  const isProduct =
    /product-research|recommendation/i.test(sectionId) ||
    /product research|recommendation/i.test(sectionTitle);
  const isErc =
    /erc-analysis/i.test(sectionId) || /\berc\b/i.test(sectionTitle);
  const isRisks =
    /risks-consumer-duty|consumer-duty/i.test(sectionId) ||
    /risks.*consumer duty/i.test(sectionTitle);

  const valueTiles = isRationale ? extractValueTiles(content) : undefined;
  const outcomes = isRisks ? extractOutcomes(content) : undefined;

  const showWarning =
    isErc ||
    (complianceFlag === 'REVIEW_REQUIRED' && Boolean(warningText)) ||
    Boolean(warningText && /data gap|action required|missing/i.test(warningText));

  return {
    body,
    consumerDuty: duty,
    recommendation: isProduct ? recommendation : undefined,
    valueTiles,
    productRows: isProduct ? table?.rows : undefined,
    productHeaders: isProduct ? table?.headers : undefined,
    warningText: showWarning ? warningText : undefined,
    outcomes,
  };
}

export function formatTemplateLabel(templateType: string): string {
  return templateType.replace(/_/g, ' ').toUpperCase();
}
