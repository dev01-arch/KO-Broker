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

export const ClientTypeSchema = z.enum(['INDIVIDUAL', 'COMPANY']);
export type ClientType = z.infer<typeof ClientTypeSchema>;

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

export const UploadDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  documentType: DocumentTypeSchema,
  caseId: z.string().optional(),
  clientId: z.string().optional(),
  storageUrl: z.string().url('A valid storage URL is required'),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
});
export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;

export const SendMessageSchema = z.object({
  subject: z.string().optional(),
  body: z.string().min(1, 'Message body is required'),
  channel: MessageChannelSchema.default('IN_APP'),
  sourceType: MessageSourceSchema.default('CASE_UPDATE'),
  caseId: z.string().optional(),
  clientId: z.string().optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const MarkMessageReadSchema = z.object({
  isRead: z.boolean(),
});
export type MarkMessageReadInput = z.infer<typeof MarkMessageReadSchema>;

export const GenerateReportSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  templateType: ReportTemplateSchema,
});
export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;

export const RegenerateSectionSchema = z
  .object({
    reportId: z.string().min(1, 'Report ID is required'),
    sectionId: z.string().optional(),
    sectionKey: z.string().optional(),
    adviserContext: z.string().optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((data) => ({
    reportId: data.reportId,
    sectionId: data.sectionId ?? data.sectionKey ?? '',
    adviserContext: data.adviserContext,
    context: data.context,
  }))
  .refine((data) => data.sectionId.length > 0, {
    message: 'sectionId is required',
    path: ['sectionId'],
  });
export type RegenerateSectionInput = z.infer<typeof RegenerateSectionSchema>;

export const AdvanceStageSchema = z
  .object({
    caseId: z.string().min(1, 'Case ID is required'),
    targetStage: CaseStageSchema.optional(),
    toStage: CaseStageSchema.optional(),
    notes: z.string().optional(),
  })
  .transform((data) => ({
    caseId: data.caseId,
    targetStage: (data.targetStage ?? data.toStage)!,
    notes: data.notes,
  }))
  .refine((data) => Boolean(data.targetStage), {
    message: 'targetStage is required',
    path: ['targetStage'],
  });
export type AdvanceStageInput = z.infer<typeof AdvanceStageSchema>;

export const CheckoutSchema = z.object({
  plan: z.enum(['PROFESSIONAL', 'ENTERPRISE']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export const EquifaxIntegrationSchema = z.object({
  apiKey: z.string().optional(),
  enabled: z.boolean().optional(),
});
export type EquifaxIntegration = z.infer<typeof EquifaxIntegrationSchema>;

export const TwilioIntegrationSchema = z.object({
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  enabled: z.boolean().optional(),
});
export type TwilioIntegration = z.infer<typeof TwilioIntegrationSchema>;

export const OrgIntegrationsSchema = z.object({
  equifax: EquifaxIntegrationSchema.extend({ enabled: z.boolean() }).optional(),
  twilio: TwilioIntegrationSchema.extend({ enabled: z.boolean() }).optional(),
});
export type OrgIntegrations = z.infer<typeof OrgIntegrationsSchema>;

export const UpdateIntegrationsSchema = z.object({
  equifax: EquifaxIntegrationSchema.optional(),
  twilio: TwilioIntegrationSchema.optional(),
});
export type UpdateIntegrationsInput = z.infer<typeof UpdateIntegrationsSchema>;

export const OrgMessagingSettingsSchema = z.object({
  inApp: z.object({ enabled: z.boolean() }).optional(),
  email: z.object({ enabled: z.boolean() }).optional(),
  sms: z.object({ enabled: z.boolean() }).optional(),
});
export type OrgMessagingSettings = z.infer<typeof OrgMessagingSettingsSchema>;

export const UpdateMessagingSettingsSchema = OrgMessagingSettingsSchema;
export type UpdateMessagingSettingsInput = z.infer<typeof UpdateMessagingSettingsSchema>;

export const CreateClientSchema = z
  .object({
    clientType: ClientTypeSchema.default('INDIVIDUAL'),
    title: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    companyNumber: z.string().optional(),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
    employmentStatus: EmploymentStatusSchema.optional(),
    annualIncome: z.number().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.clientType === 'COMPANY') {
      if (!data.companyName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Company name is required',
          path: ['companyName'],
        });
      }
      return;
    }

    if (!data.firstName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'First name is required',
        path: ['firstName'],
      });
    }
    if (!data.lastName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Last name is required',
        path: ['lastName'],
      });
    }
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

export const UpdateCaseSchema = z.object({
  stage: CaseStageSchema.optional(),
  propertyValue: z.number().positive().optional(),
  loanAmount: z.number().positive().optional(),
  termYears: z.number().int().positive().optional(),
  selectedLender: z.string().optional(),
  selectedProduct: z.string().optional(),
  selectedRate: z.number().optional(),
  selectedFee: z.number().optional(),
  adviserNotes: z.string().optional(),
  assignedAdviserId: z.string().nullable().optional(),
});
export type UpdateCaseInput = z.infer<typeof UpdateCaseSchema>;

const factFindSectionSchema = z.record(z.string(), z.unknown());

export const UpsertFactFindSchema = z.object({
  personalDetails: factFindSectionSchema.optional(),
  employmentDetails: factFindSectionSchema.optional(),
  incomeDetails: factFindSectionSchema.optional(),
  expenditureDetails: factFindSectionSchema.optional(),
  propertyDetails: factFindSectionSchema.optional(),
  existingMortgages: factFindSectionSchema.optional(),
  clientPreferences: factFindSectionSchema.optional(),
  markComplete: z.boolean().optional(),
});
export type UpsertFactFindInput = z.infer<typeof UpsertFactFindSchema>;

// ── API response envelope types ──

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
    delivery?: unknown;
    broadcastCount?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
    details?: string[];
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
