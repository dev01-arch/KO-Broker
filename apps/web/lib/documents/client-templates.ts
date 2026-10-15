import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Firm documents the broker can email.
 * The services-and-costs file is the initial disclosure (FCA status, services, and fees).
 * The same file is also the terms of business, stored under a different name when that send runs.
 * Research and ESIS have no file in the library, so those sends stay unavailable.
 */
export const CLIENT_TEMPLATE_IDS = ['idd', 'privacy', 'tob', 'survey', 'research', 'esis'] as const;

export type ClientTemplateId = (typeof CLIENT_TEMPLATE_IDS)[number];

export type ClientTemplateFile = {
  id: ClientTemplateId;
  label: string;
  storedName: string;
  filename: string;
  mimeType: string;
  content: Buffer;
};

type TemplateSpec = {
  id: ClientTemplateId;
  label: string;
  storedName: string;
  filename?: string;
  mimeType?: string;
};

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ODT = 'application/vnd.oasis.opendocument.text';

const TEMPLATE_SPECS: TemplateSpec[] = [
  {
    id: 'idd',
    label: 'Initial disclosure',
    storedName: 'Initial Disclosure Document.docx',
    filename: 'terms-of-business-resi-btl.docx',
    mimeType: DOCX,
  },
  {
    id: 'privacy',
    label: 'Customer privacy notice',
    storedName: 'Customer Privacy Notice.docx',
    filename: 'customer-privacy-notice.docx',
    mimeType: DOCX,
  },
  {
    id: 'tob',
    label: 'Terms of business',
    storedName: 'Terms of Business.docx',
    filename: 'terms-of-business-resi-btl.docx',
    mimeType: DOCX,
  },
  {
    id: 'survey',
    label: 'Feedback survey',
    storedName: 'Client Feedback Survey.odt',
    filename: 'client-feedback-survey.odt',
    mimeType: ODT,
  },
  { id: 'research', label: 'Research pack', storedName: 'Research pack' },
  { id: 'esis', label: 'ESIS', storedName: 'ESIS' },
];

export function isClientTemplateId(value: string): value is ClientTemplateId {
  return (CLIENT_TEMPLATE_IDS as readonly string[]).includes(value);
}

/** Outbound survey file. A client reply is a different document and must not match this. */
export function isOutboundFeedbackSurvey(name: string): boolean {
  return /client feedback survey/i.test(name) && !/response/i.test(name);
}

function templateDirectory(): string {
  const candidates = [path.join(process.cwd(), 'templates', 'client-documents')];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.unshift(path.resolve(here, '../../templates/client-documents'));
  } catch {
    // import.meta.url is unavailable in some runtimes; cwd candidates still apply.
  }
  candidates.push(path.join(process.cwd(), 'apps', 'web', 'templates', 'client-documents'));
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}

export function clientTemplateCatalog(): Array<{
  id: ClientTemplateId;
  label: string;
  storedName: string;
  available: boolean;
}> {
  const dir = templateDirectory();
  return TEMPLATE_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    storedName: spec.storedName,
    available: Boolean(spec.filename && existsSync(path.join(dir, spec.filename))),
  }));
}

export async function readClientTemplate(id: ClientTemplateId): Promise<ClientTemplateFile | null> {
  const spec = TEMPLATE_SPECS.find((entry) => entry.id === id);
  if (!spec?.filename || !spec.mimeType) return null;
  const filePath = path.join(templateDirectory(), spec.filename);
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath);
  if (content.byteLength === 0) return null;
  return {
    id: spec.id,
    label: spec.label,
    storedName: spec.storedName,
    filename: spec.filename,
    mimeType: spec.mimeType,
    content,
  };
}
