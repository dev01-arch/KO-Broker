/**
 * Shared TypeScript types & Zod schemas — PRD-05
 *
 * Base validation schemas for all entities.
 * Used by API route handlers and frontend forms.
 */

import { z } from 'zod';

// ── Enums (mirroring Prisma enums for runtime validation) ──

export const PlanSchema = z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']);
export type Plan = z.infer<typeof PlanSchema>;

export const RoleSchema = z.enum(['ADMIN', 'ADVISER', 'COMPLIANCE', 'VIEWER']);
export type Role = z.infer<typeof RoleSchema>;

export const EmploymentStatusSchema = z.enum([
  'EMPLOYED',
  'SELF_EMPLOYED',
  'CONTRACTOR',
  'RETIRED',
  'UNEMPLOYED',
]);
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;

export const CaseTypeSchema = z.enum([
  'PURCHASE',
  'REMORTGAGE',
  'BTL',
  'FURTHER_ADVANCE',
  'PRODUCT_TRANSFER',
]);
export type CaseType = z.infer<typeof CaseTypeSchema>;

export const CaseStageSchema = z.enum([
  'ENQUIRY',
  'FACT_FIND',
  'RESEARCH',
  'DIP',
  'OFFER',
  'COMPLETION',
  'ARCHIVED',
]);
export type CaseStage = z.infer<typeof CaseStageSchema>;

export const ReportTemplateSchema = z.enum([
  'BTL',
  'FTB',
  'REMORTGAGE',
  'HOME_MOVER',
  'PRODUCT_TRANSFER',
  'DIVORCE',
  'SELF_EMPLOYED',
  'VULNERABLE_OVERLAY',
]);
export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;

export const ReportStatusSchema = z.enum(['DRAFT', 'ADVISER_REVIEW', 'APPROVED', 'FINALISED']);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const MessageDirectionSchema = z.enum(['INBOUND', 'OUTBOUND', 'SYSTEM']);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

export const MessageChannelSchema = z.enum(['EMAIL', 'SMS', 'IN_APP']);
export type MessageChannel = z.infer<typeof MessageChannelSchema>;

export const MessageSourceSchema = z.enum([
  'CASE_UPDATE',
  'COMPLIANCE',
  'AI_REPORT',
  'CLIENT_REPLY',
  'SYSTEM',
]);
export type MessageSource = z.infer<typeof MessageSourceSchema>;

export const DocumentTypeSchema = z.enum([
  'ID',
  'INCOME',
  'FINANCIAL',
  'LENDER',
  'COMPLIANCE',
  'OTHER',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

// ── Request body schemas ──

export const CreateClientSchema = z.object({
  title: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  employmentStatus: EmploymentStatusSchema.optional(),
  annualIncome: z.number().positive().optional(),
});
export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const CreateCaseSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  type: CaseTypeSchema,
  propertyValue: z.number().positive().optional(),
  loanAmount: z.number().positive().optional(),
  termYears: z.number().int().positive().optional(),
});
export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;

export const UpdateCaseStageSchema = z.object({
  stage: CaseStageSchema,
});
export type UpdateCaseStageInput = z.infer<typeof UpdateCaseStageSchema>;

// ── API response envelope types ──

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    perPage: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ── Plan feature gating ──

export const PLAN_FEATURES: Record<Plan, string[]> = {
  STARTER: ['core_crm', 'compliance_engine', 'calculators'],
  PROFESSIONAL: [
    'core_crm',
    'compliance_engine',
    'calculators',
    'messages',
    'ai_reports',
    'client_portal',
  ],
  ENTERPRISE: [
    'core_crm',
    'compliance_engine',
    'calculators',
    'messages',
    'ai_reports',
    'client_portal',
    'lender_api_submissions',
    'custom_domain',
  ],
};

export function canAccessFeature(plan: Plan, feature: string): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}
