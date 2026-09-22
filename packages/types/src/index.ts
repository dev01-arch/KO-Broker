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

export const ClientStatusSchema = z.enum(['PROSPECT', 'ACTIVE', 'INACTIVE']);
export type ClientStatus = z.infer<typeof ClientStatusSchema>;

export const ClientCategoryFilterSchema = z.enum(['REFERRAL', 'INDIVIDUAL', 'COMPANY']);
export type ClientCategoryFilter = z.infer<typeof ClientCategoryFilterSchema>;

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

/** Backend alias — same shape as SendMessageSchema */
export const CreateMessageSchema = SendMessageSchema;
export type CreateMessageInput = SendMessageInput;

export const MarkMessageReadSchema = z.object({
  isRead: z.boolean(),
});
export type MarkMessageReadInput = z.infer<typeof MarkMessageReadSchema>;

/** Backend alias */
export const PatchMessageSchema = MarkMessageReadSchema;
export type PatchMessageInput = MarkMessageReadInput;

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

/** Backend compliance advance schema (subset; notes supported via AdvanceStageSchema) */
export const AdvanceComplianceStageSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  targetStage: z.enum(['FACT_FIND', 'RESEARCH', 'ESIS', 'SUITABILITY_REPORT', 'COMPLETION']),
});
export type AdvanceComplianceStageInput = z.infer<typeof AdvanceComplianceStageSchema>;

export const CompleteComplianceItemSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
  itemId: z.string().min(1, 'Checklist item ID is required'),
});
export type CompleteComplianceItemInput = z.infer<typeof CompleteComplianceItemSchema>;

export const CheckoutSchema = z.object({
  plan: z.enum(['PROFESSIONAL', 'ENTERPRISE']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

// ── Client Portal Schemas (backend) ──
export const VerifyPortalTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});
export type VerifyPortalTokenInput = z.infer<typeof VerifyPortalTokenSchema>;

export const SetupClientPortalSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});
export type SetupClientPortalInput = z.infer<typeof SetupClientPortalSchema>;

export const LoginClientPortalSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginClientPortalInput = z.infer<typeof LoginClientPortalSchema>;

// ── Adviser Access Schemas (backend) ──
export const InviteAdviserSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  canViewAllClients: z.boolean().default(false),
  canViewAccountDetails: z.boolean().default(false),
  canViewAiSummaries: z.boolean().default(false),
});
export type InviteAdviserInput = z.infer<typeof InviteAdviserSchema>;

export const UpdateAdviserVisibilitySchema = z.object({
  isActive: z.boolean().optional(),
  canViewAllClients: z.boolean().optional(),
  canViewAccountDetails: z.boolean().optional(),
  canViewAiSummaries: z.boolean().optional(),
});
export type UpdateAdviserVisibilityInput = z.infer<typeof UpdateAdviserVisibilitySchema>;

export const AcceptAdviserInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
});
export type AcceptAdviserInviteInput = z.infer<typeof AcceptAdviserInviteSchema>;

/** Backend bulk products sync schema */
export const SaveProductsSchema = z.object({
  products: z
    .array(
      z.object({
        lenderName: z.string().min(1, 'Lender name is required'),
        productName: z.string().min(1, 'Product name is required'),
        rate: z.number().nonnegative().nullable().optional(),
        fee: z.number().nonnegative().nullable().optional(),
        isSelected: z.boolean().default(false),
      }),
    )
    .min(1, 'At least one product must be recorded'),
});
export type SaveProductsInput = z.infer<typeof SaveProductsSchema>;

export const CreateDocumentSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  documentType: DocumentTypeSchema.default('OTHER'),
  storageUrl: z.string().url('A valid storage URL is required'),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  caseId: z.string().optional(),
  clientId: z.string().optional(),
});
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

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
    isReferred: z.boolean().optional(),
    referredToCompany: z.string().optional(),
    assignedMemberId: z.string().optional(),
    insurerName: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.email?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email is required',
        path: ['email'],
      });
    }

    if (data.clientType === 'COMPANY') {
      if (!data.companyName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Company name is required',
          path: ['companyName'],
        });
      }
      if (!data.companyNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Company registration number is required',
          path: ['companyNumber'],
        });
      }
      return;
    }

    if (data.isReferred === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please indicate whether this client is being referred',
        path: ['isReferred'],
      });
    }
    if (data.isReferred && !data.referredToCompany?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Referred company is required',
        path: ['referredToCompany'],
      });
    }

    if (!data.employmentStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Employment status is required',
        path: ['employmentStatus'],
      });
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

/** Canonical CSV headers for the KO client import template (PRD-17). */
export const CLIENT_IMPORT_TEMPLATE_HEADERS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'title',
  'dateOfBirth',
  'employmentStatus',
  'annualIncome',
  'clientType',
  'companyName',
  'companyNumber',
  'insurerName',
  'assignedAdviserEmail',
] as const;

export type ClientImportField = (typeof CLIENT_IMPORT_TEMPLATE_HEADERS)[number];

export const CLIENT_IMPORT_TEMPLATE_EXAMPLE_ROW = [
  'Jane',
  'Adeyemi',
  'jane.adeyemi@example.com',
  '07700900000',
  'Ms',
  '14/03/1988',
  'EMPLOYED',
  '65000',
  'INDIVIDUAL',
  '',
  '',
  '',
  '',
] as const;

/** Frontend warns and blocks confirm above this. */
export const CLIENT_IMPORT_GUIDED_MAX_ROWS = 500;
/** Server rejects the commit above this. */
export const CLIENT_IMPORT_HARD_MAX_ROWS = 1000;

const optionalImportString = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

export const ImportClientRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  firstName: optionalImportString,
  lastName: optionalImportString,
  email: z.string().transform((value) => value.trim()),
  phone: optionalImportString,
  title: optionalImportString,
  dateOfBirth: optionalImportString,
  employmentStatus: optionalImportString,
  annualIncome: z.union([z.number(), z.string()]).optional(),
  clientType: optionalImportString,
  companyName: optionalImportString,
  companyNumber: optionalImportString,
  insurerName: optionalImportString,
  assignedAdviserEmail: optionalImportString,
});
export type ImportClientRow = z.infer<typeof ImportClientRowSchema>;

export const ImportClientsSchema = z.object({
  fileName: z.string().optional(),
  sendWelcomeEmails: z.boolean().optional().default(false),
  duplicateEmail: z.literal('skip').optional().default('skip'),
  rows: z.array(ImportClientRowSchema).min(1, 'At least one row is required'),
});
export type ImportClientsInput = z.infer<typeof ImportClientsSchema>;

export const ImportClientResultStatusSchema = z.enum(['CREATED', 'SKIPPED', 'FAILED']);
export type ImportClientResultStatus = z.infer<typeof ImportClientResultStatusSchema>;

export const ImportClientRowResultSchema = z.object({
  rowNumber: z.number().int().positive(),
  status: ImportClientResultStatusSchema,
  clientId: z.string().optional(),
  referenceNumber: z.string().optional(),
  fields: z.record(z.string()).optional(),
});
export type ImportClientRowResult = z.infer<typeof ImportClientRowResultSchema>;

export const ImportClientsResultSchema = z.object({
  created: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: z.array(ImportClientRowResultSchema),
});
export type ImportClientsResult = z.infer<typeof ImportClientsResultSchema>;

export const UpdateClientSchema = z.object({
  title: z.string().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  companyName: z.string().optional(),
  companyNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  employmentStatus: EmploymentStatusSchema.optional(),
  annualIncome: z.number().positive().optional(),
  isVulnerable: z.boolean().optional(),
  vulnerabilityNotes: z.string().optional(),
  portalEnabled: z.boolean().optional(),
  assignedMemberId: z.string().nullable().optional(),
  status: ClientStatusSchema.optional(),
  isReferred: z.boolean().optional(),
  referredToCompany: z.string().optional(),
  insurerName: z.string().optional(),
});
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;

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
  // PRD-16: Property + Lender FK
  propertyId: z.string().nullable().optional(),
  lenderId: z.string().nullable().optional(),
  lenderOtherName: z.string().nullable().optional(),
  // PRD-16: Date spine
  aipAt: z.string().datetime().nullable().optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  offerIssuedAt: z.string().datetime().nullable().optional(),
  offerExpiresAt: z.string().datetime().nullable().optional(),
  exchangeAt: z.string().datetime().nullable().optional(),
  completionAt: z.string().datetime().nullable().optional(),
  // PRD-16: Account strip
  rateType: z.string().nullable().optional(),
  monthlyPayment: z.number().nullable().optional(),
  initialRateEndsAt: z.string().datetime().nullable().optional(),
  chargeType: z.string().nullable().optional(),
  isOffset: z.boolean().nullable().optional(),
});
export type UpdateCaseInput = z.infer<typeof UpdateCaseSchema>;

/** Product considered during RESEARCH stage (compliance: ≥3 + one selected). */
export const CreateProductConsideredSchema = z.object({
  lenderName: z.string().min(1, 'Lender name is required'),
  productName: z.string().min(1, 'Product name is required'),
  rate: z.number().optional(),
  fee: z.number().optional(),
  isSelected: z.boolean().optional(),
  reasonNotSelected: z.string().optional(),
});
export type CreateProductConsideredInput = z.infer<typeof CreateProductConsideredSchema>;

export const UpdateProductConsideredSchema = z.object({
  lenderName: z.string().min(1).optional(),
  productName: z.string().min(1).optional(),
  rate: z.number().nullable().optional(),
  fee: z.number().nullable().optional(),
  isSelected: z.boolean().optional(),
  reasonNotSelected: z.string().nullable().optional(),
});
export type UpdateProductConsideredInput = z.infer<typeof UpdateProductConsideredSchema>;

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

/** Alias used by portal/adviser fact-find endpoints in the backend spec. */
export const FactFindUpdateSchema = UpsertFactFindSchema;
export type FactFindUpdateInput = UpsertFactFindInput;

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
  STARTER: ['core_crm', 'compliance_engine', 'calculators', 'mortgage_intelligence'],
  PROFESSIONAL: [
    'core_crm',
    'compliance_engine',
    'calculators',
    'mortgage_intelligence',
    'messages',
    'ai_reports',
    'client_portal',
  ],
  ENTERPRISE: [
    'core_crm',
    'compliance_engine',
    'calculators',
    'mortgage_intelligence',
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

// ── PRD-15: Mortgage Intelligence schemas ─────────────────────────────────────

export const IntelligenceSourceSchema = z.enum(['MANUAL', 'CONFIRMED_FROM_CASE']);
export type IntelligenceSource = z.infer<typeof IntelligenceSourceSchema>;

export const MarketSignalSchema = z.enum(['IMPROVING', 'STABLE', 'WORSENING']);
export type MarketSignal = z.infer<typeof MarketSignalSchema>;

// ── POST /api/intelligence/snapshots — request body ──────────────────────────

export const CreateSnapshotSchema = z
  .object({
    postcode: z
      .string()
      .min(2, 'Postcode is required')
      .max(10)
      .transform((v) => v.trim().toUpperCase()),
    propertyValue: z.number().positive('Property value must be positive'),
    mortgageAmount: z.number().positive('Mortgage amount must be positive'),
    termYears: z.number().int().min(1).max(40),
    deposit: z.number().nonnegative().optional(),
    grossIncome: z.number().nonnegative().optional(),
    secondIncome: z.number().nonnegative().optional(),
    monthlyCommitments: z.number().nonnegative().optional(),
    caseId: z.string().optional(),
    source: IntelligenceSourceSchema,
    confirmedAt: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'CONFIRMED_FROM_CASE') {
      if (!data.caseId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'caseId is required when source is CONFIRMED_FROM_CASE',
          path: ['caseId'],
        });
      }
      if (!data.confirmedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'confirmedAt is required when source is CONFIRMED_FROM_CASE',
          path: ['confirmedAt'],
        });
      }
    }
  });
export type CreateSnapshotInput = z.infer<typeof CreateSnapshotSchema>;

// ── Snapshot response shape — fully rendered, no client-side maths needed ─────

export interface SnapshotGeography {
  region: string | null;
  adminDistrict: string | null;
  constituency: string | null;
}

/**
 * Everything the result panels render — no client-side maths required.
 * Declared as a type alias (not an interface) so it satisfies Prisma's
 * InputJsonValue, which requires an implicit index signature.
 */
export type SnapshotOutputs = {
  ltvPct: number | null;
  ltvBandLabel: 'HIGH' | 'STANDARD' | null;
  ltiRatio: number | null;
  dtiPct: number | null;
  dtiBandLabel: 'WATCH' | 'OK' | null;
  monthlyPayment: number | null;
  marketSignal: MarketSignal | null;
  benchmarkRate2yr: number | null;
  benchmarkRate5yr: number | null;
  benchmarkRateVariable75: number | null;
  effectiveNewRate: number | null;
  /** Property value against the local median, as a percentage difference. */
  vsMedianPct: number | null;
};

export type SnapshotSources = {
  rates: { source: string; seriesId: string; value: number; asAt: string } | null;
  localPrices: {
    source: string;
    outwardCode: string;
    medianPrice: number;
    change12mPct: number | null;
    txnCount12m: number;
    asOf: string;
  } | null;
  geography: { source: string; region: string | null; adminDistrict: string | null } | null;
};

export interface SnapshotResponse {
  id: string;
  orgId: string;
  caseId: string | null;
  source: IntelligenceSource;
  confirmedAt: string | null;
  generatedAt: string;
  postcode: string;
  outwardCode: string;
  propertyValue: number;
  deposit: number | null;
  mortgageAmount: number;
  termYears: number;
  grossIncome: number | null;
  secondIncome: number | null;
  monthlyCommitments: number | null;
  ltv: number | null;
  lti: number | null;
  dti: number | null;
  dtiBand: string | null;
  monthlyPayment: number | null;
  marketSignal: MarketSignal | null;
  insightText: string;
  watchText: string | null;
  outputsJson: SnapshotOutputs;
  sourcesJson: SnapshotSources;
  geography: SnapshotGeography;
}

// ── GET /api/intelligence/cases/:caseId/preview — response ───────────────────

export interface PresenceField<T> {
  value: T | null;
  present: boolean;
}

export interface CasePreviewResponse {
  caseLabel: string;
  postcode: PresenceField<string>;
  propertyValue: PresenceField<number>;
  deposit: PresenceField<number>;
  mortgageAmount: PresenceField<number>;
  termYears: PresenceField<number>;
  grossIncome: PresenceField<number>;
  monthlyCommitments: PresenceField<number>;
}

// ── GET /api/intelligence/overview — response ─────────────────────────────────

export interface RateCard {
  seriesId: string;
  label: string;
  value: number;
  change12mBps: number | null;
  asAt: string;
}

export interface FeedStatusCard {
  feedId: string;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  isStale: boolean;
}

export interface OverviewResponse {
  rates: RateCard[];
  marketSignal: MarketSignal | null;
  feedStatuses: FeedStatusCard[];
}

// ── GET /api/intelligence/rates/current — response ───────────────────────────

export interface CurrentRatesResponse {
  fixed2yr: { value: number; asAt: string } | null;
  fixed5yr: { value: number; asAt: string } | null;
  variable75: { value: number; asAt: string } | null;
}

// ── PRD-16: Lender directory, Property, CaseNote, ClientInfoRequest schemas ───

// Enums
export const LenderStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'LEGACY']);
export type LenderStatus = z.infer<typeof LenderStatusSchema>;

export const LenderSourceSchema = z.enum(['SEED', 'FCA', 'OTHER']);
export type LenderSource = z.infer<typeof LenderSourceSchema>;

export const PropertyTypeSchema = z.enum(['RESIDENTIAL', 'BTL', 'OTHER']);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const CaseNoteSourceSchema = z.enum(['ADVISER', 'INTEL', 'SYSTEM']);
export type CaseNoteSource = z.infer<typeof CaseNoteSourceSchema>;

export const InfoRequestStatusSchema = z.enum(['OUTSTANDING', 'FULFILLED', 'CANCELLED']);
export type InfoRequestStatus = z.infer<typeof InfoRequestStatusSchema>;

// ── GET /api/lenders?q= ───────────────────────────────────────────────────────

export const LenderSearchQuerySchema = z.object({
  q: z.string().optional(),
});
export type LenderSearchQuery = z.infer<typeof LenderSearchQuerySchema>;

/** Shape of a single lender row returned by GET /api/lenders */
export interface LenderRow {
  id: string;
  name: string;
  normalizedName: string;
  status: LenderStatus;
  source: LenderSource;
}

// ── POST /api/cases/:id/notes ─────────────────────────────────────────────────

export const CreateCaseNoteSchema = z.object({
  body: z.string().min(1, 'Note body is required'),
  tag: z.string().optional(),
});
export type CreateCaseNoteInput = z.infer<typeof CreateCaseNoteSchema>;

// ── POST /api/clients/:id/properties ─────────────────────────────────────────

export const CreatePropertySchema = z.object({
  postcode: z
    .string()
    .min(2, 'Postcode is required')
    .max(10)
    .transform((v) => v.trim().toUpperCase()),
  address: z.record(z.string(), z.unknown()).optional(),
  tenure: z.string().optional(),
  type: PropertyTypeSchema.optional(),
  currentValue: z.number().positive().optional(),
  monthlyRent: z.number().nonnegative().optional(),
});
export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;

// ── PATCH /api/cases/:id — date spine + account strip ────────────────────────

export const UpdateCaseDateSpineSchema = z.object({
  aipAt: z.string().datetime().nullable().optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  offerIssuedAt: z.string().datetime().nullable().optional(),
  offerExpiresAt: z.string().datetime().nullable().optional(),
  exchangeAt: z.string().datetime().nullable().optional(),
  completionAt: z.string().datetime().nullable().optional(),
  rateType: z.string().nullable().optional(),
  monthlyPayment: z.number().nullable().optional(),
  initialRateEndsAt: z.string().datetime().nullable().optional(),
  chargeType: z.string().nullable().optional(),
  isOffset: z.boolean().nullable().optional(),
});
export type UpdateCaseDateSpineInput = z.infer<typeof UpdateCaseDateSpineSchema>;

// ── POST /api/cases/:id/info-requests ────────────────────────────────────────

export const CreateInfoRequestSchema = z.object({
  checklistItemId: z.string().optional(),
  documentType: DocumentTypeSchema.optional(),
  body: z.string().optional(),
  channel: MessageChannelSchema.optional(),
}).refine(
  (data) => data.checklistItemId !== undefined || data.documentType !== undefined,
  { message: 'Either checklistItemId or documentType is required' },
);
export type CreateInfoRequestInput = z.infer<typeof CreateInfoRequestSchema>;
