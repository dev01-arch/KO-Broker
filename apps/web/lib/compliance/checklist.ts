/**
 * FCA-style 16-item compliance checklist used by the live dashboard UI.
 *
 * Items are derived from existing case/client/document/report data plus
 * optional `CHECKLIST:<itemId>` ComplianceRecord rows (adviser-confirmed).
 * This does not change stage-gate logic in workflow.ts.
 */

import type { CaseStage, CaseType } from '@ko/types';

export const CHECKLIST_RECORD_PREFIX = 'CHECKLIST:';

export const COMPLIANCE_ITEM_IDS = [
  'idd',
  'privacy',
  'consent',
  'marketing',
  'tob-sent',
  'tob-accepted',
  'aml',
  'adverse-credit',
  'vulnerability',
  'fact-find',
  'esis',
  'suitability',
  'aip',
  'survey-sent',
  'survey-response',
  'case-complete',
] as const;

export type ComplianceItemId = (typeof COMPLIANCE_ITEM_IDS)[number];

export type ComplianceItemStatus =
  | 'complete'
  | 'accepted'
  | 'confirmed'
  | 'sent'
  | 'pending'
  | 'advisory';

export type CompliancePhaseStatus = 'done' | 'attention' | 'pending';

export interface CompliancePhaseItemView {
  n: number;
  itemId: ComplianceItemId;
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
  status: CompliancePhaseStatus;
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

export interface ChecklistEvidenceDoc {
  name: string;
  documentType: string;
  createdAt: Date | string;
  caseId?: string | null;
}

export interface ChecklistEvidenceRecord {
  stage: string;
  completedAt: Date | string;
  isApproved?: boolean;
}

export interface ChecklistCaseInput {
  id: string;
  referenceNumber: string;
  type: CaseType;
  stage: CaseStage;
  createdAt: Date | string;
  updatedAt?: Date | string;
  adviserNotes?: string | null;
  selectedProduct?: string | null;
  selectedLender?: string | null;
  client: {
    firstName: string;
    lastName: string;
    companyName?: string | null;
    clientType?: string | null;
    referenceNumber?: string | null;
    isVulnerable?: boolean;
    portalEnabled?: boolean;
    vulnerabilityNotes?: string | null;
  };
  adviser?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  factFind?: {
    completedAt?: Date | string | null;
    existingMortgages?: unknown;
    clientPreferences?: unknown;
  } | null;
  productsConsidered?: Array<{ isSelected: boolean }>;
  documents?: ChecklistEvidenceDoc[];
  complianceRecords?: ChecklistEvidenceRecord[];
  suitabilityReports?: Array<{ status: string; updatedAt?: Date | string }>;
}

const CASE_STAGE_ORDER: CaseStage[] = [
  'ENQUIRY',
  'FACT_FIND',
  'RESEARCH',
  'DIP',
  'OFFER',
  'COMPLETION',
  'ARCHIVED',
];

const CASE_TYPE_LABELS: Record<CaseType, string> = {
  PURCHASE: 'Purchase',
  REMORTGAGE: 'Remortgage',
  BTL: 'BTL',
  FURTHER_ADVANCE: 'Further Advance',
  PRODUCT_TRANSFER: 'Product Transfer',
};

/** UI buckets on the Compliance Overview page (not the backend CaseStage enum). */
export const OVERVIEW_STAGE_BUCKETS: Array<{ key: string; label: string }> = [
  { key: 'disclosure', label: 'Initial Disclosure' },
  { key: 'tob', label: 'Terms of Business' },
  { key: 'factfind', label: 'Fact-Find & AML' },
  { key: 'research', label: 'Research & ESIS' },
  { key: 'suitability', label: 'Suitability & AIP' },
  { key: 'complete', label: 'Complete' },
];

export const FIRM_DOCUMENT_LIBRARY: Array<{
  id: string;
  code: string;
  name: string;
  fullName: string;
  patterns: RegExp[];
}> = [
  {
    id: 'idd',
    code: 'IDD',
    name: 'IDD',
    fullName: 'Initial Disclosure Document',
    patterns: [/idd/i, /initial\s*disclosure/i],
  },
  {
    id: 'privacy',
    code: 'PN',
    name: 'Privacy Notice',
    fullName: 'Privacy Notice',
    patterns: [/privacy/i],
  },
  {
    id: 'tob',
    code: 'TOB',
    name: 'Terms of Business',
    fullName: 'Terms of Business',
    patterns: [/terms of business/i, /\btob\b/i],
  },
  {
    id: 'suitability-template',
    code: 'SLT',
    name: 'Suitability Letter Template',
    fullName: 'Suitability Letter Template',
    patterns: [/suitability/i],
  },
  {
    id: 'aip',
    code: 'AIP',
    name: 'AIP',
    fullName: 'Agreement in Principle',
    patterns: [/\baip\b/i, /agreement in principle/i],
  },
  {
    id: 'survey',
    code: 'Survey Doc',
    name: 'Survey Document',
    fullName: 'Client Satisfaction Survey',
    patterns: [/survey/i],
  },
  {
    id: 'consent',
    code: 'Consent Capture',
    name: 'Consent Capture',
    fullName: 'Consent Capture Form',
    patterns: [/consent/i],
  },
];

type CatalogItem = {
  n: number;
  itemId: ComplianceItemId;
  name: string;
  desc: string;
  version?: string;
};

type CatalogPhase = {
  id: string;
  num: string;
  title: string;
  framework: string;
  items: CatalogItem[];
};

const PHASE_CATALOG: CatalogPhase[] = [
  {
    id: 'disclosure',
    num: '01',
    title: 'Case creation & initial disclosure',
    framework: 'FCA MCOB 4.4',
    items: [
      {
        n: 1,
        itemId: 'idd',
        name: 'IDD sent to client',
        desc: 'Initial disclosure document issued to the client.',
        version: 'v2.1',
      },
      {
        n: 2,
        itemId: 'privacy',
        name: 'Privacy Notice sent to client',
        desc: 'Privacy notice shared and acknowledged.',
        version: 'v1.4',
      },
    ],
  },
  {
    id: 'consent',
    num: '02',
    title: 'Client activation & consent',
    framework: 'UK GDPR',
    items: [
      {
        n: 3,
        itemId: 'consent',
        name: 'Data subject consent captured',
        desc: 'Client consent recorded for data processing.',
        version: 'v1.0',
      },
      {
        n: 4,
        itemId: 'marketing',
        name: 'Marketing consent recorded',
        desc: 'Marketing preferences confirmed offline by adviser.',
      },
    ],
  },
  {
    id: 'tob',
    num: '03',
    title: 'Terms of business',
    framework: 'FCA MCOB 4',
    items: [
      {
        n: 5,
        itemId: 'tob-sent',
        name: 'TOB sent to client',
        desc: 'Terms of business issued to the client for review.',
        version: 'v3.0',
      },
      {
        n: 6,
        itemId: 'tob-accepted',
        name: 'TOB accepted by client',
        desc: 'Client acceptance of terms of business.',
      },
    ],
  },
  {
    id: 'aml',
    num: '04',
    title: 'Fact-find & AML',
    framework: 'CONSUMER DUTY',
    items: [
      {
        n: 7,
        itemId: 'aml',
        name: 'AML check completed',
        desc: 'Anti-money laundering checks completed.',
        version: 'v3.0',
      },
      {
        n: 8,
        itemId: 'adverse-credit',
        name: 'Adverse credit assessed',
        desc: 'Adverse credit findings reviewed for this case.',
      },
      {
        n: 9,
        itemId: 'vulnerability',
        name: 'Vulnerability assessment completed',
        desc: 'Client vulnerability characteristics assessed.',
        version: 'v1.0',
      },
      {
        n: 10,
        itemId: 'fact-find',
        name: 'Fact-find complete',
        desc: 'Digital fact-find questionnaire completed.',
        version: 'v1.0',
      },
    ],
  },
  {
    id: 'esis',
    num: '05',
    title: 'Research & ESIS',
    framework: 'FCA MCOB 5',
    items: [
      {
        n: 11,
        itemId: 'esis',
        name: 'ESIS received and filed',
        desc: 'European Standardised Information Sheet filed on the case.',
      },
    ],
  },
  {
    id: 'suitability',
    num: '06',
    title: 'Suitability letter & AIP',
    framework: 'FCA MCOB 5',
    items: [
      {
        n: 12,
        itemId: 'suitability',
        name: 'Suitability letter approved',
        desc: 'Suitability letter reviewed and approved for issue.',
      },
      {
        n: 13,
        itemId: 'aip',
        name: 'AIP generated and sent to client',
        desc: 'Agreement in principle generated and sent.',
      },
    ],
  },
  {
    id: 'completion',
    num: '07',
    title: 'Completion & feedback',
    framework: 'CONSUMER DUTY',
    items: [
      {
        n: 14,
        itemId: 'survey-sent',
        name: 'Feedback survey sent',
        desc: 'Client feedback survey issued automatically.',
      },
      {
        n: 15,
        itemId: 'survey-response',
        name: 'Survey response received',
        desc: 'Client survey response captured.',
      },
      {
        n: 16,
        itemId: 'case-complete',
        name: 'Case marked complete',
        desc: 'Case closed and marked complete.',
      },
    ],
  },
];

export function isComplianceItemId(value: string): value is ComplianceItemId {
  return (COMPLIANCE_ITEM_IDS as readonly string[]).includes(value);
}

export function checklistRecordStage(itemId: ComplianceItemId): string {
  return `${CHECKLIST_RECORD_PREFIX}${itemId}`;
}

export function parseChecklistRecordItemId(stage: string): ComplianceItemId | null {
  if (!stage.startsWith(CHECKLIST_RECORD_PREFIX)) return null;
  const id = stage.slice(CHECKLIST_RECORD_PREFIX.length);
  return isComplianceItemId(id) ? id : null;
}

export function formatClientDisplayName(client: ChecklistCaseInput['client']): string {
  if (client.clientType === 'COMPANY') {
    return client.companyName?.trim() || client.firstName;
  }
  return `${client.firstName} ${client.lastName}`.trim();
}

export function formatAdviserShortName(
  adviser: ChecklistCaseInput['adviser'] | null | undefined,
): string {
  if (!adviser) return '—';
  const first = adviser.firstName?.trim() ?? '';
  const last = adviser.lastName?.trim() ?? '';
  if (first && last) return `${first[0]}. ${last}`;
  return `${first} ${last}`.trim() || '—';
}

export function caseTypeLabel(type: CaseType): string {
  return CASE_TYPE_LABELS[type] ?? type;
}

export function complianceStageLabel(stage: CaseStage): string {
  switch (stage) {
    case 'ENQUIRY':
      return 'Initial Disclosure';
    case 'FACT_FIND':
      return 'Fact-Find & AML';
    case 'RESEARCH':
      return 'Research & ESIS';
    case 'DIP':
      return 'Research & ESIS';
    case 'OFFER':
      return 'Suitability & AIP';
    case 'COMPLETION':
      return 'Complete';
    case 'ARCHIVED':
      return 'Archived';
    default:
      return stage;
  }
}

function stageIndex(stage: CaseStage): number {
  const idx = CASE_STAGE_ORDER.indexOf(stage);
  return idx < 0 ? 0 : idx;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatComplianceTimestamp(value: Date | string | null | undefined): string {
  const date = asDate(value);
  if (!date) return '';
  const day = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} at ${time}`;
}

export function formatTimeAgo(value: Date | string | null | undefined): string {
  const date = asDate(value);
  if (!date) return '';
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatShortDate(value: Date | string | null | undefined): string {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function docsOf(input: ChecklistCaseInput): ChecklistEvidenceDoc[] {
  return input.documents ?? [];
}

function findDoc(docs: ChecklistEvidenceDoc[], patterns: RegExp[]): ChecklistEvidenceDoc | undefined {
  return docs.find((doc) => patterns.some((re) => re.test(doc.name)));
}

function hasDocType(docs: ChecklistEvidenceDoc[], type: string): ChecklistEvidenceDoc | undefined {
  return docs.find((doc) => doc.documentType === type);
}

function recordMap(input: ChecklistCaseInput): Map<string, ChecklistEvidenceRecord> {
  const map = new Map<string, ChecklistEvidenceRecord>();
  for (const record of input.complianceRecords ?? []) {
    if (!map.has(record.stage)) map.set(record.stage, record);
  }
  return map;
}

function jsonMentions(value: unknown, pattern: RegExp): boolean {
  if (value == null) return false;
  try {
    return pattern.test(JSON.stringify(value).toLowerCase());
  } catch {
    return false;
  }
}

function doneItem(
  catalog: CatalogItem,
  status: Extract<ComplianceItemStatus, 'complete' | 'accepted' | 'confirmed'>,
  at: Date | string | null | undefined,
  badge: string,
): CompliancePhaseItemView {
  const when = formatComplianceTimestamp(at) || formatComplianceTimestamp(new Date());
  return {
    n: catalog.n,
    itemId: catalog.itemId,
    name: catalog.name,
    desc: catalog.desc,
    status,
    badges: [badge],
    meta: when,
    version: catalog.version,
    detail: true,
    audit: {
      title: catalog.name,
      sent: when,
      completed: when,
      version: catalog.version || '—',
      statusLabel: badge,
    },
  };
}

function pendingItem(
  catalog: CatalogItem,
  options?: {
    status?: ComplianceItemStatus;
    badges?: string[];
    actions?: CompliancePhaseItemView['actions'];
    note?: string;
    meta?: string;
  },
): CompliancePhaseItemView {
  const status = options?.status ?? 'pending';
  return {
    n: catalog.n,
    itemId: catalog.itemId,
    name: catalog.name,
    desc: catalog.desc,
    status,
    badges: options?.badges ?? ['Not started'],
    actions: options?.actions ?? ['complete', 'confirm'],
    note: options?.note,
    meta: options?.meta,
    version: catalog.version,
  };
}

function evaluateItem(catalog: CatalogItem, input: ChecklistCaseInput): CompliancePhaseItemView {
  const docs = docsOf(input);
  const records = recordMap(input);
  const manual = records.get(checklistRecordStage(catalog.itemId));
  const idx = stageIndex(input.stage);
  const factFindDoneAt = asDate(input.factFind?.completedAt ?? null);
  const latestReport = input.suitabilityReports?.[0];
  const reportDone =
    latestReport?.status === 'FINALISED' || latestReport?.status === 'APPROVED';

  if (manual) {
    return doneItem(catalog, 'confirmed', manual.completedAt, 'Confirmed offline');
  }

  switch (catalog.itemId) {
    case 'idd': {
      const doc =
        findDoc(docs, [/idd/i, /initial\s*disclosure/i]) ?? hasDocType(docs, 'COMPLIANCE');
      if (doc || records.has('INITIAL_DISCLOSURE') || idx >= stageIndex('FACT_FIND')) {
        return doneItem(catalog, 'complete', doc?.createdAt ?? input.createdAt, 'Complete');
      }
      return pendingItem(catalog, { actions: ['complete', 'confirm'] });
    }
    case 'privacy': {
      const doc = findDoc(docs, [/privacy/i]);
      if (doc || idx >= stageIndex('FACT_FIND')) {
        return doneItem(catalog, 'complete', doc?.createdAt ?? input.createdAt, 'Complete');
      }
      return pendingItem(catalog);
    }
    case 'consent': {
      const doc = findDoc(docs, [/consent/i]);
      if (input.client.portalEnabled || doc) {
        return doneItem(catalog, 'accepted', doc?.createdAt ?? input.updatedAt ?? input.createdAt, 'Accepted');
      }
      return pendingItem(catalog);
    }
    case 'marketing': {
      return pendingItem(catalog, {
        status: 'pending',
        badges: ['Not started'],
        actions: ['confirm'],
        note: 'Confirm offline if marketing preferences were captured outside the platform.',
      });
    }
    case 'tob-sent': {
      const doc = findDoc(docs, [/terms of business/i, /\btob\b/i]);
      if (doc || idx >= stageIndex('FACT_FIND')) {
        return {
          ...doneItem(catalog, 'complete', doc?.createdAt ?? input.createdAt, 'Sent'),
          status: 'sent',
          badges: ['Sent', 'AUTO'],
          actions: undefined,
        };
      }
      return pendingItem(catalog, { actions: ['resend', 'confirm'] });
    }
    case 'tob-accepted': {
      const doc = findDoc(docs, [/tob.?accept/i, /acceptance/i]);
      if (doc) {
        return doneItem(catalog, 'accepted', doc.createdAt, 'Accepted');
      }
      if (idx >= stageIndex('FACT_FIND')) {
        return pendingItem(catalog, {
          status: 'advisory',
          badges: ['Advisory'],
          actions: ['complete', 'confirm'],
          note: 'Advisory — The case can proceed. Mark complete when this item is handled.',
        });
      }
      return pendingItem(catalog);
    }
    case 'aml': {
      const doc = hasDocType(docs, 'ID') ?? findDoc(docs, [/\baml\b/i, /identity/i, /\bid\b/i]);
      if (doc) {
        return doneItem(catalog, 'confirmed', doc.createdAt, 'Confirmed offline');
      }
      return pendingItem(catalog, { actions: ['confirm'] });
    }
    case 'adverse-credit': {
      const mentioned = jsonMentions(
        input.factFind?.existingMortgages ?? input.factFind?.clientPreferences,
        /adverse|ccj|default|iva|bankrupt/,
      );
      if (mentioned) {
        return pendingItem(catalog, {
          status: 'advisory',
          badges: ['Advisory'],
          actions: ['confirm'],
          note: 'Advisory flag raised. Confirm this has been reviewed — or use “Confirm offline” if handled outside the platform.',
        });
      }
      if (factFindDoneAt) {
        return doneItem(catalog, 'complete', factFindDoneAt, 'Complete');
      }
      return pendingItem(catalog, { actions: ['confirm'] });
    }
    case 'vulnerability': {
      if (factFindDoneAt || input.client.vulnerabilityNotes || input.client.isVulnerable) {
        return doneItem(
          catalog,
          'complete',
          factFindDoneAt ?? input.updatedAt ?? input.createdAt,
          'Complete',
        );
      }
      return pendingItem(catalog);
    }
    case 'fact-find': {
      if (factFindDoneAt || records.has('FACT_FIND') || idx >= stageIndex('RESEARCH')) {
        return doneItem(catalog, 'complete', factFindDoneAt ?? input.updatedAt, 'Complete');
      }
      return pendingItem(catalog, { actions: ['complete'] });
    }
    case 'esis': {
      const doc = findDoc(docs, [/esis/i]);
      if (doc || records.has('ESIS') || idx >= stageIndex('OFFER')) {
        return doneItem(catalog, 'complete', doc?.createdAt ?? input.updatedAt, 'Complete');
      }
      if (idx >= stageIndex('DIP')) {
        return pendingItem(catalog, {
          status: 'advisory',
          badges: ['Advisory'],
          actions: ['complete', 'confirm'],
          note: 'ESIS is required before advancing from Application.',
        });
      }
      return pendingItem(catalog);
    }
    case 'suitability': {
      if (reportDone || records.has('SUITABILITY_REPORT') || idx >= stageIndex('COMPLETION')) {
        return doneItem(catalog, 'complete', latestReport?.updatedAt ?? input.updatedAt, 'Complete');
      }
      return pendingItem(catalog, {
        note: 'Advisory — The case can proceed. Mark complete when this item is handled.',
      });
    }
    case 'aip': {
      const doc = findDoc(docs, [/\baip\b/i, /agreement in principle/i, /\bdip\b/i]);
      if (doc || idx >= stageIndex('DIP')) {
        return doneItem(catalog, 'complete', doc?.createdAt ?? input.updatedAt, 'Complete');
      }
      return pendingItem(catalog);
    }
    case 'survey-sent': {
      if (idx >= stageIndex('COMPLETION')) {
        return doneItem(catalog, 'complete', input.updatedAt, 'Complete');
      }
      return pendingItem(catalog, { badges: ['Not started', 'AUTO'], actions: undefined });
    }
    case 'survey-response': {
      const doc = findDoc(docs, [/survey/i, /feedback/i]);
      if (doc) return doneItem(catalog, 'complete', doc.createdAt, 'Complete');
      return pendingItem(catalog);
    }
    case 'case-complete': {
      if (input.stage === 'COMPLETION') {
        return doneItem(catalog, 'complete', input.updatedAt, 'Complete');
      }
      return pendingItem(catalog);
    }
    default:
      return pendingItem(catalog);
  }
}

function isItemDone(item: CompliancePhaseItemView): boolean {
  return item.status === 'complete' || item.status === 'accepted' || item.status === 'confirmed';
}

function phaseStatus(items: CompliancePhaseItemView[]): CompliancePhaseStatus {
  if (items.length > 0 && items.every(isItemDone)) return 'done';
  if (items.some((item) => item.status === 'advisory' || !isItemDone(item))) {
    const anyStarted = items.some((item) => isItemDone(item) || item.status === 'sent' || item.status === 'advisory');
    return anyStarted ? 'attention' : 'pending';
  }
  return 'pending';
}

function collectFlags(input: ChecklistCaseInput, phases: CompliancePhaseView[]): ComplianceFlagView[] {
  const flags: ComplianceFlagView[] = [];
  const clientName = formatClientDisplayName(input.client);
  const when = asDate(input.updatedAt) ?? asDate(input.createdAt) ?? new Date();

  if (input.client.isVulnerable) {
    flags.push({
      title: 'Vulnerable customer identified',
      priority: 'medium',
      clientName,
      referenceNumber: input.referenceNumber,
      caseId: input.id,
      createdAt: when.toISOString(),
      timeAgo: formatTimeAgo(when),
    });
  }

  for (const phase of phases) {
    for (const item of phase.items) {
      if (item.status !== 'advisory') continue;
      flags.push({
        title: item.name,
        priority: item.itemId === 'adverse-credit' || item.itemId === 'esis' ? 'medium' : 'low',
        clientName,
        referenceNumber: input.referenceNumber,
        caseId: input.id,
        createdAt: when.toISOString(),
        timeAgo: formatTimeAgo(when),
      });
    }
  }

  return flags;
}

export function overviewBucketForCase(
  input: ChecklistCaseInput,
  phases: CompliancePhaseView[],
): string {
  if (input.stage === 'COMPLETION') return 'complete';
  if (input.stage === 'OFFER') return 'suitability';
  if (input.stage === 'RESEARCH' || input.stage === 'DIP') return 'research';
  if (input.stage === 'FACT_FIND') return 'factfind';

  const tob = phases.find((p) => p.id === 'tob');
  const tobStarted = tob?.items.some((item) => isItemDone(item) || item.status === 'sent');
  if (tobStarted) return 'tob';
  return 'disclosure';
}

export function evaluateCaseCompliance(input: ChecklistCaseInput): CaseComplianceSnapshot {
  const phases: CompliancePhaseView[] = PHASE_CATALOG.map((phase) => {
    const items = phase.items.map((item) => evaluateItem(item, input));
    return {
      id: phase.id,
      num: phase.num,
      title: phase.title,
      framework: phase.framework,
      status: phaseStatus(items),
      open: false,
      items,
    };
  });

  const current = phases.find((phase) => phase.status !== 'done');
  if (current) current.open = true;

  let progressDone = 0;
  let progressTotal = 0;
  for (const phase of phases) {
    for (const item of phase.items) {
      progressTotal += 1;
      if (isItemDone(item)) progressDone += 1;
    }
  }

  const flags = collectFlags(input, phases);
  const progressPct = progressTotal === 0 ? 0 : Math.round((progressDone / progressTotal) * 100);

  return {
    caseId: input.id,
    stage: input.stage,
    stageLabel: complianceStageLabel(input.stage),
    progressDone,
    progressTotal,
    progressPct,
    flagCount: flags.length,
    flags,
    phases,
  };
}

export function toComplianceCaseRow(
  input: ChecklistCaseInput,
  snapshot: CaseComplianceSnapshot,
): ComplianceCaseRow {
  return {
    id: input.id,
    clientName: formatClientDisplayName(input.client),
    adviserName: formatAdviserShortName(input.adviser),
    createdAt: asDate(input.createdAt)?.toISOString() ?? new Date().toISOString(),
    createdLabel: formatShortDate(input.createdAt),
    referenceNumber: input.referenceNumber,
    clientReference: input.client.referenceNumber ?? undefined,
    type: input.type,
    typeLabel: caseTypeLabel(input.type),
    stage: input.stage,
    stageLabel: snapshot.stageLabel,
    progressDone: snapshot.progressDone,
    progressTotal: snapshot.progressTotal,
    progressPct: snapshot.progressPct,
    flagCount: snapshot.flagCount,
  };
}

export function evaluateFirmDocumentLibrary(docs: ChecklistEvidenceDoc[]): FirmDocumentRow[] {
  return FIRM_DOCUMENT_LIBRARY.map((entry) => {
    const match = findDoc(docs, entry.patterns);
    return {
      id: entry.id,
      code: entry.code,
      name: entry.name,
      fullName: entry.fullName,
      uploaded: Boolean(match),
      version: match ? 'v1.0' : null,
      statusLabel: match ? 'Active' : 'Not uploaded',
    };
  });
}

export function buildComplianceOverview(
  cases: ChecklistCaseInput[],
  firmDocs: ChecklistEvidenceDoc[],
): ComplianceOverviewPayload {
  const active = cases.filter((c) => c.stage !== 'ARCHIVED');
  const snapshots = active.map((c) => ({ input: c, snapshot: evaluateCaseCompliance(c) }));
  const documents = evaluateFirmDocumentLibrary(firmDocs);

  const stageCounts = new Map(OVERVIEW_STAGE_BUCKETS.map((b) => [b.key, 0]));
  let checklistDone = 0;
  let checklistTotal = 0;
  const flags: ComplianceFlagView[] = [];

  const rows: ComplianceCaseRow[] = snapshots.map(({ input, snapshot }) => {
    checklistDone += snapshot.progressDone;
    checklistTotal += snapshot.progressTotal;
    flags.push(...snapshot.flags);
    const bucket = overviewBucketForCase(input, snapshot.phases);
    stageCounts.set(bucket, (stageCounts.get(bucket) ?? 0) + 1);
    return toComplianceCaseRow(input, snapshot);
  });

  const docsUploaded = documents.filter((d) => d.uploaded).length;
  const checklistPct = checklistTotal === 0 ? 0 : Math.round((checklistDone / checklistTotal) * 100);

  return {
    kpis: {
      activeCases: active.filter((c) => c.stage !== 'COMPLETION').length,
      totalCases: active.length,
      checklistDone,
      checklistTotal,
      checklistPct,
      advisoryFlags: flags.length,
      docsUploaded,
      docsTotal: documents.length,
      docsProForma: documents.length - docsUploaded,
      platformPct: checklistPct,
    },
    stages: OVERVIEW_STAGE_BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: stageCounts.get(bucket.key) ?? 0,
    })),
    cases: rows,
    flags,
    documents,
  };
}
