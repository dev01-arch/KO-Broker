/**
 * Report prompt builder — PRD-09
 *
 * Constructs the system and user prompts for AI suitability report generation.
 * Section titles are aligned with complianceCheck REQUIRED_SECTIONS so approve works.
 */

import type { ReportTemplate } from '@ko/types';
import { REQUIRED_SECTIONS } from '@/lib/ai/complianceCheck';

export type { ReportTemplate };

export interface ReportPromptInput {
  templateType: ReportTemplate;
  client: Record<string, unknown>;
  caseData: Record<string, unknown>;
  productsConsidered: Record<string, unknown>[];
  selectedProduct?: Record<string, unknown> | null;
  adviserNotes?: string | null;
  isVulnerable: boolean;
}

/**
 * SYSTEM_PROMPT — fixed for all templates.
 * Instructs the AI to generate compliant, factual, FCA-aligned content.
 */
export const SYSTEM_PROMPT = `You are an expert UK FCA-regulated mortgage compliance assistant. \
Generate a complete suitability report. Write in clear, professional British English. \
Never invent or assume facts not present in the data. \
Every section must include at least one Consumer Duty evidencing statement. \
Flag any section where data is insufficient. \
Return ONLY valid JSON in the format: \
{ "sections": [{ "id": string, "title": string, "content": string, "complianceFlag": "OK" | "REVIEW_REQUIRED", "flagReason": string | null }] }`;

/**
 * buildReportPrompt — constructs the user prompt string for a given template and case.
 */
export function buildReportPrompt(input: ReportPromptInput): string {
  const {
    templateType,
    client,
    caseData,
    productsConsidered,
    selectedProduct,
    adviserNotes,
    isVulnerable,
  } = input;

  const sections = REQUIRED_SECTIONS[templateType];

  return [
    `Template: ${templateType}.`,
    `Required sections (in order): ${sections.join(' | ')}.`,
    `Use kebab-case ids derived from each section title (e.g. "Client Introduction" → "client-introduction").`,
    `Client: ${JSON.stringify(client)}.`,
    `Case: ${JSON.stringify(caseData)}.`,
    `Products considered (${productsConsidered.length}): ${JSON.stringify(productsConsidered)}.`,
    selectedProduct ? `Selected product: ${JSON.stringify(selectedProduct)}.` : 'No product selected.',
    adviserNotes ? `Adviser notes: ${adviserNotes}.` : 'No adviser notes.',
    `Vulnerable customer: ${isVulnerable}.`,
    isVulnerable
      ? 'IMPORTANT: Client is flagged as vulnerable. Ensure all sections explicitly address Consumer Duty vulnerability obligations.'
      : '',
    'Generate all required sections. Return ONLY valid JSON.',
  ]
    .filter(Boolean)
    .join('\n');
}
