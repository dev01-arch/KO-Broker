/**
 * Typed API client for the KO Broker backend.
 * All requests carry the Clerk session JWT in the Authorization header.
 */

import { caseStageToComplianceAdvanceTarget } from '@ko/utils';

/** Same-origin by default so local /api/* routes receive the Clerk session token. */
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ─── Response envelope ──────────────────────────────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
    delivery?: MessageDeliveryMeta;
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

// ─── Domain types ────────────────────────────────────────────────────────────

export type EmploymentStatus =
  | 'EMPLOYED'
  | 'SELF_EMPLOYED'
  | 'CONTRACTOR'
  | 'RETIRED'
  | 'UNEMPLOYED';

export type ClientType = 'INDIVIDUAL' | 'COMPANY';

export type ClientStatus = 'PROSPECT' | 'ACTIVE' | 'INACTIVE';

export type ClientCategoryFilter = 'REFERRAL' | 'INDIVIDUAL' | 'COMPANY';

export interface ClientMemberRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ClientSummary {
  id: string;
  referenceNumber: string;
  clientType?: ClientType;
  companyName?: string;
  firstName: string;
  lastName: string;
  email: string;
  employmentStatus: EmploymentStatus;
  annualIncome?: number;
  isReferred?: boolean;
  referredToCompany?: string;
  status: ClientStatus;
  insurerName?: string;
  isVulnerable: boolean;
  assignedMember: ClientMemberRef | null;
  _count: {
    cases: number;
    messages: number;
  };
}

export type CaseType =
  | 'PURCHASE'
  | 'REMORTGAGE'
  | 'BTL'
  | 'FURTHER_ADVANCE'
  | 'PRODUCT_TRANSFER';

export type CaseStage =
  | 'ENQUIRY'
  | 'FACT_FIND'
  | 'RESEARCH'
  | 'DIP'
  | 'OFFER'
  | 'COMPLETION'
  | 'ARCHIVED';

export interface CaseClientRef {
  id: string;
  clientType?: ClientType;
  companyName?: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CaseAdviserRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface CaseSummary {
  id: string;
  referenceNumber: string;
  clientId: string;
  client: CaseClientRef;
  type: CaseType;
  stage: CaseStage;
  propertyValue?: number;
  loanAmount?: number;
  ltv?: number;
  termYears?: number;
  selectedLender?: string;
  selectedProduct?: string;
  adviser: CaseAdviserRef | null;
  updatedAt: string;
  _count: {
    messages: number;
    documents: number;
  };
}

export interface FactFind {
  id: string;
  caseId?: string;
  personalDetails?: Record<string, unknown>;
  employmentDetails?: Record<string, unknown>;
  incomeDetails?: Record<string, unknown>;
  expenditureDetails?: Record<string, unknown>;
  propertyDetails?: Record<string, unknown>;
  existingMortgages?: Record<string, unknown>;
  clientPreferences?: Record<string, unknown>;
  completedAt?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface Case extends CaseSummary {
  selectedRate?: number;
  selectedFee?: number;
  adviserNotes?: string;
  assignedAdviserId?: string;
  createdAt: string;
  client: CaseClientRef & {
    referenceNumber: string;
    phone?: string;
    employmentStatus: string;
  };
  factFind: FactFind | null;
  productsConsidered?: ProductConsidered[];
  _count: {
    messages: number;
    documents: number;
  };
}

export interface ProductConsidered {
  id: string;
  caseId: string;
  lenderName: string;
  productName: string;
  rate?: number;
  fee?: number;
  isSelected: boolean;
  reasonNotSelected?: string;
  createdAt: string;
}

export interface CreateProductConsideredInput {
  lenderName: string;
  productName: string;
  rate?: number;
  fee?: number;
  isSelected?: boolean;
  reasonNotSelected?: string;
}

export interface UpdateProductConsideredInput {
  lenderName?: string;
  productName?: string;
  rate?: number | null;
  fee?: number | null;
  isSelected?: boolean;
  reasonNotSelected?: string | null;
}

/** Minimal case row embedded on client detail responses. */
export interface ClientCaseSummary {
  id: string;
  referenceNumber: string;
  type: string;
  stage: string;
}

export interface Client extends Omit<ClientSummary, '_count'> {
  companyNumber?: string;
  title?: string;
  phone?: string;
  dateOfBirth?: string;
  portalEnabled: boolean;
  vulnerabilityNotes?: string;
  cases: ClientCaseSummary[];
  _count: {
    messages: number;
    documents: number;
  };
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface ListClientsParams {
  page?: number;
  perPage?: number;
  search?: string;
  employmentStatus?: EmploymentStatus;
  clientType?: ClientType;
  isReferred?: boolean;
  clientCategory?: ClientCategoryFilter;
  status?: ClientStatus;
  assignedMemberId?: string;
  insurerName?: string;
}

export interface CreateClientInput {
  clientType?: ClientType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyNumber?: string;
  email: string;
  title?: string;
  phone?: string;
  dateOfBirth?: string;
  employmentStatus?: EmploymentStatus;
  annualIncome?: number;
  isReferred?: boolean;
  referredToCompany?: string;
  assignedMemberId?: string;
  insurerName?: string;
}

export interface UpdateClientInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  employmentStatus?: EmploymentStatus;
  annualIncome?: number;
  isVulnerable?: boolean;
  vulnerabilityNotes?: string;
  portalEnabled?: boolean;
}

export interface ListCasesParams {
  page?: number;
  perPage?: number;
  search?: string;
  stage?: CaseStage;
  type?: CaseType;
  clientId?: string;
  adviserId?: string;
}

export interface CreateCaseInput {
  clientId: string;
  type: CaseType;
  propertyValue?: number;
  loanAmount?: number;
  termYears?: number;
}

export interface UpdateCaseInput {
  stage?: CaseStage;
  propertyValue?: number;
  loanAmount?: number;
  termYears?: number;
  selectedLender?: string;
  selectedProduct?: string;
  selectedRate?: number;
  selectedFee?: number;
  adviserNotes?: string;
  assignedAdviserId?: string | null;
}

export interface UpsertFactFindInput {
  personalDetails?: Record<string, unknown>;
  employmentDetails?: Record<string, unknown>;
  incomeDetails?: Record<string, unknown>;
  expenditureDetails?: Record<string, unknown>;
  propertyDetails?: Record<string, unknown>;
  existingMortgages?: Record<string, unknown>;
  clientPreferences?: Record<string, unknown>;
  markComplete?: boolean;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
    public status?: number,
    public details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Unwraps the standard API envelope — throws ApiError on failure, returns data on success.
 * @see API Integration Guide §2 Response Envelope
 */
export async function apiRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await apiFetch<T>(path, token, options);
  return response.data;
}

async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<ApiSuccessResponse<T>> {
  // When uploading FormData, let the browser set the Content-Type (multipart boundary).
  // Passing an empty headers object from the caller signals this case.
  const isFormData = options.body instanceof FormData;
  const defaultHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    redirect: 'manual',
    headers: {
      ...defaultHeaders,
      // Allow caller to override/add headers, but filter out empty Content-Type overrides.
      ...(options.headers && !isFormData ? options.headers : {}),
    },
  });

  if (res.type === 'opaqueredirect' || res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
    throw new ApiError(
      'UNAUTHORIZED',
      'Session expired. Please sign in again.',
      undefined,
      res.status,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      'INVALID_RESPONSE',
      'Unexpected response from server. Check API URL configuration.',
      undefined,
      res.status,
    );
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiError(
      json.error?.code ?? 'INTERNAL_ERROR',
      json.error?.message ?? 'An unexpected error occurred',
      json.error?.fields,
      res.status,
      json.error?.details,
    );
  }

  return json;
}

/** Fetch a binary response (e.g. PDF download). Throws ApiError on failure. */
async function apiFetchBlob(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (res.type === 'opaqueredirect' || res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) {
    throw new ApiError(
      'UNAUTHORIZED',
      'Session expired. Please sign in again.',
      undefined,
      res.status,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.success) {
        throw new ApiError(
          json.error?.code ?? 'INTERNAL_ERROR',
          json.error?.message ?? 'An unexpected error occurred',
          json.error?.fields,
          res.status,
          json.error?.details,
        );
      }
    }
    throw new ApiError('INTERNAL_ERROR', 'Could not download file', undefined, res.status);
  }

  if (!contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
    throw new ApiError(
      'INVALID_RESPONSE',
      'Unexpected response from server. Expected a PDF file.',
      undefined,
      res.status,
    );
  }

  const disposition = res.headers.get('content-disposition') ?? '';
  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);
  const blob = await res.blob();
  return { blob, filename: filenameMatch?.[1] ?? null };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export {
  API_ERROR_CODES,
  formatApiError,
  getApiErrorCode,
  getApiErrorFieldMap,
  getApiErrorDetails,
  getApiErrorFields,
  isApiErrorCode,
  requireAuthToken,
  type ApiErrorCode,
} from './errors';

// ─── Client endpoints ─────────────────────────────────────────────────────────

export const clientsApi = {
  list(token: string, params: ListClientsParams = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.perPage) qs.set('perPage', String(params.perPage));
    if (params.search) qs.set('search', params.search);
    if (params.employmentStatus) qs.set('employmentStatus', params.employmentStatus);
    if (params.clientType) qs.set('clientType', params.clientType);
    if (params.isReferred !== undefined) qs.set('isReferred', String(params.isReferred));
    if (params.clientCategory) qs.set('clientCategory', params.clientCategory);
    if (params.status) qs.set('status', params.status);
    if (params.assignedMemberId) qs.set('assignedMemberId', params.assignedMemberId);
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<ClientSummary[]>(`/api/clients${query}`, token);
  },

  get(token: string, id: string) {
    return apiFetch<Client>(`/api/clients/${id}`, token);
  },

  create(token: string, input: CreateClientInput) {
    return apiFetch<Pick<Client, 'id' | 'referenceNumber' | 'firstName' | 'lastName' | 'email'>>(
      '/api/clients',
      token,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },

  update(token: string, id: string, input: UpdateClientInput) {
    return apiFetch<Pick<Client, 'id' | 'firstName' | 'isVulnerable'>>(
      `/api/clients/${id}`,
      token,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
  },

  delete(token: string, id: string) {
    return apiFetch<{ deleted: boolean }>(`/api/clients/${id}`, token, { method: 'DELETE' });
  },
};

// ─── Document types ───────────────────────────────────────────────────────────

export type DocumentType = 'ID' | 'INCOME' | 'FINANCIAL' | 'LENDER' | 'COMPLIANCE' | 'OTHER';

export interface DocumentRecord {
  id: string;
  orgId: string;
  caseId?: string;
  clientId?: string;
  name: string;
  documentType: DocumentType;
  storageUrl: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  createdAt: string;
}

// ─── Message types ─────────────────────────────────────────────────────────────

export type MessageDirection = 'INBOUND' | 'OUTBOUND' | 'SYSTEM';
export type MessageChannel = 'EMAIL' | 'SMS' | 'IN_APP';
export type MessageSource = 'CASE_UPDATE' | 'COMPLIANCE' | 'AI_REPORT' | 'CLIENT_REPLY' | 'SYSTEM';

export interface MessageRecord {
  id: string;
  orgId: string;
  caseId?: string;
  clientId?: string;
  direction: MessageDirection;
  channel: MessageChannel;
  sourceType: MessageSource;
  subject?: string;
  body: string;
  isRead: boolean;
  threadId?: string;
  createdAt: string;
}

// ─── AI Report types ───────────────────────────────────────────────────────────

export type ReportTemplate =
  | 'BTL'
  | 'FTB'
  | 'REMORTGAGE'
  | 'HOME_MOVER'
  | 'PRODUCT_TRANSFER'
  | 'DIVORCE'
  | 'SELF_EMPLOYED'
  | 'VULNERABLE_OVERLAY';
export type ReportStatus = 'DRAFT' | 'ADVISER_REVIEW' | 'APPROVED' | 'FINALISED';

export interface AiReportSection {
  id: string;
  title: string;
  content: string;
  complianceFlag?: 'OK' | 'REVIEW_REQUIRED';
  flagReason?: string | null;
}

export interface AiReport {
  id: string;
  caseId: string;
  templateType: ReportTemplate;
  status: ReportStatus;
  /** Array of sections (current API) or legacy key→content object. */
  sections?: AiReportSection[] | Record<string, unknown>;
  pdfUrl?: string;
  generatedBy?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Normalise array or legacy object section shapes for UI rendering. */
export function normalizeAiReportSections(sections: AiReport['sections']): AiReportSection[] {
  if (!sections) return [];
  if (Array.isArray(sections)) {
    return sections
      .filter((s): s is AiReportSection => Boolean(s) && typeof s === 'object' && 'content' in s)
      .map((s) => ({
        id: String(s.id ?? ''),
        title: String(s.title ?? s.id ?? 'Section'),
        content: String(s.content ?? ''),
        complianceFlag: s.complianceFlag,
        flagReason: s.flagReason ?? null,
      }));
  }
  return Object.entries(sections).map(([key, value]) => ({
    id: key,
    title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim(),
    content: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

// ─── Timeline types ────────────────────────────────────────────────────────────

export interface TimelineEntry {
  id: string;
  orgId?: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Record<string, unknown>;
  notificationSent?: boolean;
  createdAt: string;
  user?: { firstName: string; lastName: string };
}

// ─── Integration settings types ────────────────────────────────────────────────

export interface EquifaxIntegration {
  apiKey?: string;
  enabled: boolean;
}

export interface TwilioIntegration {
  accountSid?: string;
  authToken?: string;
  enabled: boolean;
}

export interface OrgIntegrations {
  equifax?: EquifaxIntegration;
  twilio?: TwilioIntegration;
}

export interface OrgMessagingSettings {
  inApp?: { enabled: boolean };
  email?: { enabled: boolean };
  sms?: { enabled: boolean };
}

export interface AdviserRecord {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role?: string;
  isActive: boolean;
  createdAt: string;
  invitePending?: boolean;
  inviteTokenExpiry?: string | null;
  canViewAllClients?: boolean;
  canViewAccountDetails?: boolean;
  canViewAiSummaries?: boolean;
  /** OrganisationMember id — use for client assignedMemberId when present. */
  memberId?: string | null;
  emailSent?: boolean;
  emailError?: string;
}

export interface UpdateAdviserInput {
  isActive?: boolean;
  canViewAllClients?: boolean;
  canViewAccountDetails?: boolean;
  canViewAiSummaries?: boolean;
}

export interface CreateAdviserInput {
  firstName: string;
  lastName: string;
  email: string;
}

export interface MessageDeliveryMeta {
  inApp: 'sent' | 'skipped';
  email: 'sent' | 'skipped' | 'failed' | 'scheduled';
  sms: 'sent' | 'skipped' | 'failed';
  errors?: string[];
}

// ─── New input types ────────────────────────────────────────────────────────────

export interface ListDocumentsParams {
  page?: number;
  perPage?: number;
  caseId?: string;
  clientId?: string;
  documentType?: DocumentType;
}

export interface UploadDocumentInput {
  file: File;
  name?: string;
  documentType?: DocumentType;
  caseId?: string;
  clientId?: string;
}

export interface ListMessagesParams {
  page?: number;
  perPage?: number;
  caseId?: string;
  clientId?: string;
  unreadOnly?: boolean;
}

export interface SendMessageInput {
  body: string;
  channel?: MessageChannel;
  sourceType?: MessageSource;
  subject?: string;
  caseId?: string;
  clientId?: string;
}

export interface GenerateReportInput {
  caseId: string;
  templateType: ReportTemplate;
}

export interface RegenerateSectionInput {
  reportId: string;
  sectionId: string;
  adviserContext?: string;
}

export interface ExtractFactFindInput {
  file: File;
  caseId?: string;
  documentCategory?: string;
}

export interface ExtractFactFindResult {
  extracted: Record<string, unknown>;
  fieldsFound: number;
  documentCategory?: string;
}

export interface AdvanceStageInput {
  caseId: string;
  targetStage: CaseStage;
  notes?: string;
}

export interface UpdateIntegrationsInput {
  equifax?: {
    apiKey?: string;
    enabled?: boolean;
  };
  twilio?: {
    accountSid?: string;
    authToken?: string;
    enabled?: boolean;
  };
}

export interface UpdateMessagingSettingsInput {
  inApp?: { enabled: boolean };
  email?: { enabled: boolean };
  sms?: { enabled: boolean };
}

// ─── Case endpoints ───────────────────────────────────────────────────────────

export const casesApi = {
  list(token: string, params: ListCasesParams = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.perPage) qs.set('perPage', String(params.perPage));
    if (params.search) qs.set('search', params.search);
    if (params.stage) qs.set('stage', params.stage);
    if (params.type) qs.set('type', params.type);
    if (params.clientId) qs.set('clientId', params.clientId);
    if (params.adviserId) qs.set('adviserId', params.adviserId);
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<CaseSummary[]>(`/api/cases${query}`, token);
  },

  get(token: string, id: string) {
    return apiFetch<Case>(`/api/cases/${id}`, token);
  },

  create(token: string, input: CreateCaseInput) {
    return apiFetch<CaseSummary>('/api/cases', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update(token: string, id: string, input: UpdateCaseInput) {
    return apiFetch<CaseSummary>(`/api/cases/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  upsertFactFind(token: string, id: string, input: UpsertFactFindInput) {
    return apiFetch<{ factFind: FactFind; client?: { id: string; isVulnerable: boolean } }>(
      `/api/cases/${id}/fact-find`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    );
  },

  listProducts(token: string, caseId: string) {
    return apiFetch<ProductConsidered[]>(`/api/cases/${caseId}/products`, token);
  },

  createProduct(token: string, caseId: string, input: CreateProductConsideredInput) {
    return apiFetch<ProductConsidered>(`/api/cases/${caseId}/products`, token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateProduct(
    token: string,
    caseId: string,
    productId: string,
    input: UpdateProductConsideredInput,
  ) {
    return apiFetch<ProductConsidered>(`/api/cases/${caseId}/products/${productId}`, token, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteProduct(token: string, caseId: string, productId: string) {
    return apiFetch<{ deleted: boolean }>(`/api/cases/${caseId}/products/${productId}`, token, {
      method: 'DELETE',
    });
  },

  timeline(token: string, id: string) {
    return apiFetch<TimelineEntry[]>(`/api/cases/${id}/timeline`, token);
  },
};

// ─── Document endpoints ────────────────────────────────────────────────────────

export const documentsApi = {
  list(token: string, params: ListDocumentsParams = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.perPage) qs.set('perPage', String(params.perPage));
    if (params.caseId) qs.set('caseId', params.caseId);
    if (params.clientId) qs.set('clientId', params.clientId);
    if (params.documentType) qs.set('documentType', params.documentType);
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<DocumentRecord[]>(`/api/documents${query}`, token);
  },

  get(token: string, id: string) {
    return apiFetch<DocumentRecord>(`/api/documents/${id}`, token);
  },

  upload(token: string, input: UploadDocumentInput) {
    const fd = new FormData();
    fd.append('file', input.file);
    fd.append('name', input.name ?? input.file.name);
    if (input.documentType) fd.append('documentType', input.documentType);
    if (input.caseId) fd.append('caseId', input.caseId);
    if (input.clientId) fd.append('clientId', input.clientId);
    // FormData body: apiFetch detects this and omits Content-Type so
    // the browser sets the correct multipart/form-data boundary automatically.
    return apiFetch<DocumentRecord>('/api/documents', token, {
      method: 'POST',
      body: fd,
    });
  },

  delete(token: string, id: string) {
    return apiFetch<{ deleted: boolean }>(`/api/documents/${id}`, token, { method: 'DELETE' });
  },
};

// ─── Message endpoints ─────────────────────────────────────────────────────────

export const messagesApi = {
  list(token: string, params: ListMessagesParams = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.perPage) qs.set('perPage', String(params.perPage));
    if (params.caseId) qs.set('caseId', params.caseId);
    if (params.clientId) qs.set('clientId', params.clientId);
    if (params.unreadOnly) qs.set('unreadOnly', 'true');
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<MessageRecord[]>(`/api/messages${query}`, token);
  },

  send(token: string, input: SendMessageInput) {
    return apiFetch<MessageRecord>('/api/messages', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  markRead(token: string, id: string, isRead = true) {
    return apiFetch<MessageRecord>(`/api/messages/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    });
  },
};

// ─── AI endpoints ──────────────────────────────────────────────────────────────

export const aiApi = {
  listReports(token: string, params: { page?: number; perPage?: number; caseId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.perPage) qs.set('perPage', String(params.perPage));
    if (params.caseId) qs.set('caseId', params.caseId);
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch<AiReport[]>(`/api/ai/reports${query}`, token);
  },

  generateReport(token: string, input: GenerateReportInput) {
    return apiFetch<AiReport>('/api/ai/generate-report', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  regenerateSection(token: string, input: RegenerateSectionInput) {
    return apiFetch<AiReport>('/api/ai/regenerate-section', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  approveReport(token: string, id: string) {
    return apiFetch<AiReport>(`/api/ai/reports/${id}/approve`, token, { method: 'POST' });
  },

  /** Download a draft (or current) report PDF without approving/finalising. */
  async exportDraftPdf(token: string, id: string) {
    const { blob, filename } = await apiFetchBlob(`/api/ai/reports/${id}/export-pdf`, token, {
      method: 'POST',
    });
    triggerBlobDownload(blob, filename ?? `suitability_report_draft_${id}.pdf`);
    return { filename: filename ?? `suitability_report_draft_${id}.pdf` };
  },

  extractFactFind(token: string, input: ExtractFactFindInput) {
    const fd = new FormData();
    fd.append('file', input.file);
    if (input.caseId) fd.append('caseId', input.caseId);
    if (input.documentCategory) fd.append('documentCategory', input.documentCategory);
    return apiFetch<ExtractFactFindResult>('/api/ai/extract-fact-find', token, {
      method: 'POST',
      body: fd,
    });
  },
};

// ─── Compliance overview / checklist ──────────────────────────────────────────

export type ComplianceItemStatus =
  | 'complete'
  | 'accepted'
  | 'confirmed'
  | 'sent'
  | 'pending'
  | 'advisory';

export interface CompliancePhaseItemView {
  n: number;
  itemId: string;
  name: string;
  desc: string;
  status: ComplianceItemStatus;
  badges: string[];
  meta?: string;
  version?: string;
  detail?: boolean;
  actions?: Array<'complete' | 'confirm' | 'resend'>;
  note?: string;
  audit?: {
    title: string;
    sent: string;
    completed: string;
    version: string;
    statusLabel?: string;
  };
}

export interface CompliancePhaseView {
  id: string;
  num: string;
  title: string;
  framework: string;
  status: 'done' | 'attention' | 'pending';
  open: boolean;
  items: CompliancePhaseItemView[];
}

export interface ComplianceFlagView {
  title: string;
  priority: 'low' | 'medium';
  clientName: string;
  referenceNumber: string;
  caseId: string;
  createdAt: string;
  timeAgo: string;
}

export interface ComplianceCaseRow {
  id: string;
  clientName: string;
  adviserName: string;
  createdAt: string;
  createdLabel: string;
  referenceNumber: string;
  clientReference?: string;
  type: CaseType;
  typeLabel: string;
  stage: CaseStage;
  stageLabel: string;
  progressDone: number;
  progressTotal: number;
  progressPct: number;
  flagCount: number;
}

export interface FirmDocumentRow {
  id: string;
  code: string;
  name: string;
  fullName: string;
  uploaded: boolean;
  version: string | null;
  statusLabel: string;
}

export interface ComplianceOverviewKpis {
  activeCases: number;
  totalCases: number;
  checklistDone: number;
  checklistTotal: number;
  checklistPct: number;
  advisoryFlags: number;
  docsUploaded: number;
  docsTotal: number;
  docsProForma: number;
  platformPct: number;
}

export interface ComplianceStageBucket {
  key: string;
  label: string;
  count: number;
}

export interface CaseComplianceSnapshot {
  caseId: string;
  stage: CaseStage;
  stageLabel: string;
  progressDone: number;
  progressTotal: number;
  progressPct: number;
  flagCount: number;
  flags: ComplianceFlagView[];
  phases: CompliancePhaseView[];
}

export interface ComplianceOverviewPayload {
  kpis: ComplianceOverviewKpis;
  stages: ComplianceStageBucket[];
  cases: ComplianceCaseRow[];
  flags: ComplianceFlagView[];
  documents: FirmDocumentRow[];
}

export interface CompleteComplianceItemInput {
  caseId: string;
  itemId: string;
}

// ─── Compliance endpoints ──────────────────────────────────────────────────────

export const complianceApi = {
  advanceStage(token: string, input: AdvanceStageInput) {
    const targetStage = caseStageToComplianceAdvanceTarget(String(input.targetStage));
    return apiFetch<CaseSummary>('/api/compliance/advance', token, {
      method: 'POST',
      body: JSON.stringify({ caseId: input.caseId, targetStage }),
    });
  },

  getOverview(token: string) {
    return apiFetch<ComplianceOverviewPayload>('/api/compliance', token);
  },

  getCaseChecklist(token: string, caseId: string) {
    return apiFetch<CaseComplianceSnapshot>(`/api/compliance/cases/${caseId}`, token);
  },

  completeItem(token: string, input: CompleteComplianceItemInput) {
    return apiFetch<CaseComplianceSnapshot>('/api/compliance/items', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export interface OrgProfile {
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  role: 'ADMIN' | 'ADVISER' | 'COMPLIANCE' | 'VIEWER';
  orgId: string;
  orgName: string;
  canViewAllClients?: boolean;
  canViewAccountDetails?: boolean;
  canViewAiSummaries?: boolean;
}

export interface DashboardBootstrapPayload {
  org: OrgProfile | null;
  clients: ClientSummary[];
  cases: CaseSummary[];
  advisers: AdviserRecord[];
}

// ─── Dashboard bootstrap ───────────────────────────────────────────────────────

export const dashboardApi = {
  bootstrap(token: string) {
    return apiFetch<DashboardBootstrapPayload>('/api/dashboard/bootstrap', token);
  },
};

// ─── Settings endpoints ────────────────────────────────────────────────────────

export const settingsApi = {
  getOrg(token: string) {
    return apiFetch<OrgProfile>('/api/settings/org', token);
  },

  getIntegrations(token: string) {
    return apiFetch<OrgIntegrations>('/api/settings/integrations', token);
  },

  updateIntegrations(token: string, input: UpdateIntegrationsInput) {
    return apiFetch<OrgIntegrations>('/api/settings/integrations', token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  getMessaging(token: string) {
    return apiFetch<OrgMessagingSettings>('/api/settings/messaging', token);
  },

  updateMessaging(token: string, input: UpdateMessagingSettingsInput) {
    return apiFetch<OrgMessagingSettings>('/api/settings/messaging', token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  listAdvisers(token: string) {
    return apiFetch<AdviserRecord[]>('/api/settings/advisers', token);
  },

  createAdviser(token: string, input: CreateAdviserInput) {
    return apiFetch<AdviserRecord>('/api/settings/advisers', token, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateAdviser(token: string, id: string, input: UpdateAdviserInput) {
    return apiFetch<AdviserRecord>(`/api/settings/advisers/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteAdviser(token: string, id: string) {
    return apiFetch<{ message: string }>(`/api/settings/advisers/${id}`, token, {
      method: 'DELETE',
    });
  },

  resendAdviserInvite(token: string, id: string) {
    return apiFetch<{ message: string }>(`/api/settings/advisers/${id}/resend-invite`, token, {
      method: 'POST',
    });
  },
};

// ─── System types ──────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  services: {
    db: boolean;
    ai: boolean;
  };
  version: string;
}

export interface WebhookAck {
  success: boolean;
  received?: boolean;
  messageId?: string;
}

export interface EmailWebhookInput {
  from: { email: string; name?: string };
  to: Array<{ email: string; name?: string }>;
  subject: string;
  text?: string;
}

type WebhookResponse = WebhookAck | ApiErrorResponse;

async function publicJsonFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers ?? {}),
    },
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError(
      'INVALID_RESPONSE',
      'Unexpected response from server. Check API URL configuration.',
      undefined,
      res.status,
    );
  }

  return (await res.json()) as T;
}

async function webhookFetch(path: string, body: unknown): Promise<WebhookAck> {
  const json = await publicJsonFetch<WebhookResponse>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if ('error' in json && json.success === false) {
    throw new ApiError(json.error.code, json.error.message, json.error.fields);
  }

  return json as WebhookAck;
}

// ─── System endpoints ──────────────────────────────────────────────────────────

export const systemApi = {
  async health(): Promise<HealthStatus> {
    const json = await publicJsonFetch<HealthStatus>('/api/health');
    if (json.status === 'degraded') {
      throw new ApiError('SERVICE_UNAVAILABLE', 'One or more core services are degraded', undefined, 503);
    }
    return json;
  },

  async healthUnchecked(): Promise<HealthStatus> {
    return publicJsonFetch<HealthStatus>('/api/health');
  },

  postEmailWebhook(input: EmailWebhookInput) {
    return webhookFetch('/api/webhooks/email', input);
  },

  postStripeWebhook(payload: string, signature?: string) {
    return publicJsonFetch<WebhookResponse>('/api/webhooks/stripe', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'stripe-signature': signature } : {}),
      },
    }).then((json) => {
      if ('error' in json && json.success === false) {
        throw new ApiError(json.error.code, json.error.message, json.error.fields);
      }
      return json as WebhookAck;
    });
  },

  postClerkWebhook(payload: string, headers: { svixId: string; svixTimestamp: string; svixSignature: string }) {
    return publicJsonFetch<WebhookResponse>('/api/webhooks/clerk', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json',
        'svix-id': headers.svixId,
        'svix-timestamp': headers.svixTimestamp,
        'svix-signature': headers.svixSignature,
      },
    }).then((json) => {
      if ('error' in json && json.success === false) {
        throw new ApiError(json.error.code, json.error.message, json.error.fields);
      }
      return json as WebhookAck;
    });
  },
};

// ─── Billing endpoints ─────────────────────────────────────────────────────────

export const billingApi = {
  createCheckout(
    token: string,
    input: { plan: 'PROFESSIONAL' | 'ENTERPRISE'; successUrl?: string; cancelUrl?: string },
  ) {
    return apiFetch<{ url: string; checkoutUrl?: string; sessionId: string; plan: string }>(
      '/api/billing/checkout',
      token,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },

  getSubscription(token: string) {
    return apiFetch<{
      hasBillingAccount: boolean;
      hasSubscription: boolean;
      status: string | null;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string | null;
    }>('/api/billing/subscription', token);
  },

  createPortalSession(token: string) {
    return apiFetch<{ url: string }>('/api/billing/portal', token, { method: 'POST' });
  },
};

// ─── Client portal endpoints ───────────────────────────────────────────────────

export const portalApi = {
  inviteClient(token: string, caseId: string) {
    return apiRequest<{ message: string }>('/api/portal/invite', token, {
      method: 'POST',
      body: JSON.stringify({ caseId }),
    });
  },

  /** Cookie-auth portal session — pass empty token; apiFetch still sends Authorization if provided. */
  getFactFind(token: string) {
    return apiFetch<FactFind>('/api/portal/fact-find', token);
  },

  updateFactFind(token: string, input: UpsertFactFindInput) {
    return apiFetch<FactFind>('/api/portal/fact-find', token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  updateCaseFactFind(token: string, caseId: string, input: UpsertFactFindInput) {
    return apiFetch<FactFind>(`/api/portal/cases/${caseId}/fact-find`, token, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /** Marks fact-find complete (sets completedAt, vulnerability, notifies adviser). */
  completeFactFind(token: string) {
    return apiFetch<FactFind>('/api/portal/fact-find/complete', token, {
      method: 'POST',
    });
  },
};
