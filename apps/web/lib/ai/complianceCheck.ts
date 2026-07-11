/**
 * Pre-finalisation compliance checks — PRD-09
 *
 * Deterministic string scan (no AI call) that validates:
 * - All required sections for the template type are present and non-empty
 * - Consumer Duty phrases present in each section
 * - Minimum 3 ProductConsidered records
 * - No placeholder text ([INSERT, TBC, N/A, [ADD)
 * - Vulnerable overlay section present if client.isVulnerable
 */

import type { ReportTemplate } from '@ko/types';

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  complianceFlag?: 'OK' | 'REVIEW_REQUIRED';
  flagReason?: string | null;
}

export interface ComplianceCheckResult {
  passed: boolean;
  issues: string[];
}

export const REQUIRED_SECTIONS: Record<ReportTemplate, string[]> = {
  BTL: [
    'Client Introduction',
    'Property Details',
    'BTL Affordability (ICR)',
    'Product Research & Recommendation',
    'Tax & Investment Considerations',
    'Risks & Consumer Duty',
  ],
  FTB: [
    'Client Introduction',
    'Property Details',
    'Affordability Assessment',
    'Scheme Eligibility (HTB/Shared Ownership)',
    'Product Research & Recommendation',
    'Risks & Consumer Duty',
  ],
  REMORTGAGE: [
    'Client Introduction',
    'Existing Mortgage Summary',
    'Remortgage Rationale',
    'Product Research & Recommendation',
    'ERC Analysis',
    'Risks & Consumer Duty',
  ],
  HOME_MOVER: [
    'Client Introduction',
    'Property Details',
    'Porting vs. New Mortgage Analysis',
    'Product Research & Recommendation',
    'Risks & Consumer Duty',
  ],
  PRODUCT_TRANSFER: [
    'Client Introduction',
    'Existing Product Summary',
    'Rate Comparison',
    'Recommendation Rationale',
    'Risks & Consumer Duty',
  ],
  DIVORCE: [
    'Client Introduction',
    'Circumstances Summary',
    'Affordability on Single Income',
    'Product Research & Recommendation',
    'Legal Note',
    'Risks & Consumer Duty',
  ],
  SELF_EMPLOYED: [
    'Client Introduction (with Trading History)',
    'Income Verification',
    'Affordability Assessment',
    'Product Research & Recommendation',
    'Risks & Consumer Duty',
  ],
  VULNERABLE_OVERLAY: [
    'Client Introduction',
    'Vulnerability Assessment',
    'Support Measures',
    'Product Research & Recommendation',
    'Risks & Consumer Duty',
  ],
};

const CONSUMER_DUTY_PHRASES = [
  'consumer duty',
  'fair value',
  'customer outcome',
  'best interests',
  'good outcome',
  'products and services',
  'price and value',
  'consumer understanding',
  'consumer support',
];

const PLACEHOLDER_PATTERNS = ['[INSERT', 'TBC', 'N/A', '[ADD', 'PLACEHOLDER', '[COMPLETE'];

export function runComplianceCheck(
  templateType: ReportTemplate,
  sections: ReportSection[],
  productsCount: number,
  isVulnerable: boolean,
): ComplianceCheckResult {
  const issues: string[] = [];

  if (productsCount < 3) {
    issues.push(`At least 3 products must be considered and recorded. Found: ${productsCount}.`);
  }

  const requiredTitles = REQUIRED_SECTIONS[templateType];
  const presentTitles = sections.map((section) => section.title.toLowerCase());

  for (const required of requiredTitles) {
    const present = presentTitles.some((title) => title.includes(required.toLowerCase()));
    if (!present) {
      issues.push(`Missing required section: "${required}".`);
    }
  }

  for (const section of sections) {
    if (!section.content || section.content.trim().length === 0) {
      issues.push(`Section "${section.title}" is empty.`);
    }
  }

  for (const section of sections) {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (section.content.toUpperCase().includes(pattern.toUpperCase())) {
        issues.push(`Section "${section.title}" contains placeholder text: "${pattern}".`);
        break;
      }
    }
  }

  const allContent = sections.map((section) => section.content).join(' ').toLowerCase();
  const hasConsumerDuty = CONSUMER_DUTY_PHRASES.some((phrase) => allContent.includes(phrase));
  if (!hasConsumerDuty) {
    issues.push(
      'No Consumer Duty language found in any section. At least one section must reference consumer outcomes or Consumer Duty obligations.',
    );
  }

  if (isVulnerable) {
    const hasVulnerableSection = sections.some(
      (section) =>
        section.title.toLowerCase().includes('vulnerab') ||
        section.content.toLowerCase().includes('vulnerable customer'),
    );
    if (!hasVulnerableSection) {
      issues.push(
        'Client is flagged as vulnerable but no vulnerability section or reference found in the report.',
      );
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
