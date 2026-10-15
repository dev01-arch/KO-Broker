import { prisma } from '@/lib/db';
import { createDocumentForOrg } from '@/lib/api/documents-data';
import { logAuditEvent } from '@/lib/compliance/audit';
import { sendComplianceEmail } from '@/lib/notifications/email';
import { uploadToR2 } from '@/lib/storage/r2';
import {
  readClientTemplate,
  type ClientTemplateId,
} from '@/lib/documents/client-templates';
import { generateCaseIllustration } from '@/lib/documents/generate-illustration';
import { sendCaseSurveyLink } from '@/lib/survey/survey-store';

export type DisclosureDelivery = {
  sent: boolean;
  documents: Array<'idd' | 'privacy'>;
  error?: string;
};

export type SendClientDocumentResult =
  | { ok: true; template: ClientTemplateId; documentName: string }
  | { ok: false; code: 'NOT_FOUND' | 'NO_EMAIL' | 'UNAVAILABLE' | 'DELIVERY_FAILED'; message: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fileSentTemplate(input: {
  orgId: string;
  caseId: string;
  clientId: string;
  userId?: string;
  template: ClientTemplateId;
  storedName: string;
  mimeType: string;
  content: Buffer;
}) {
  const key = `orgs/${input.orgId}/cases/${input.caseId}/client-documents/${input.template}-${Date.now()}-${input.storedName.replace(/\s+/g, '_')}`;
  const storageUrl = await uploadToR2(input.content, key, input.mimeType);
  await createDocumentForOrg(input.orgId, {
    name: input.storedName,
    documentType: 'COMPLIANCE',
    caseId: input.caseId,
    clientId: input.clientId,
    storageUrl,
    mimeType: input.mimeType,
    sizeBytes: input.content.byteLength,
    uploadedBy: input.userId,
  });
}

async function loadCaseRecipient(orgId: string, caseId: string) {
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, orgId },
    select: {
      id: true,
      clientId: true,
      client: { select: { email: true, firstName: true } },
    },
  });
  if (!caseRecord) return { error: 'NOT_FOUND' as const };
  const email = caseRecord.client.email?.trim();
  if (!email) return { error: 'NO_EMAIL' as const };
  return { caseRecord, email, firstName: caseRecord.client.firstName?.trim() || 'Client' };
}

export async function sendEstablishDisclosure(input: {
  orgId: string;
  caseId: string;
  clientId: string;
  email: string | null | undefined;
  firstName: string | null | undefined;
  userId?: string;
}): Promise<DisclosureDelivery> {
  const [idd, privacy] = await Promise.all([readClientTemplate('idd'), readClientTemplate('privacy')]);
  const files = [idd, privacy].filter((file): file is NonNullable<typeof file> => Boolean(file));
  if (files.length === 0) {
    return { sent: false, documents: [], error: 'The disclosure templates are not in the document library.' };
  }

  const documents: Array<'idd' | 'privacy'> = [];
  for (const file of files) {
    if (file.id !== 'idd' && file.id !== 'privacy') continue;
    try {
      await fileSentTemplate({
        orgId: input.orgId,
        caseId: input.caseId,
        clientId: input.clientId,
        userId: input.userId,
        template: file.id,
        storedName: file.storedName,
        mimeType: file.mimeType,
        content: file.content,
      });
      documents.push(file.id);
    } catch (error) {
      console.error('[sendEstablishDisclosure] could not file', file.id, error);
    }
  }

  const email = input.email?.trim();
  if (!email) {
    return { sent: false, documents, error: 'This client has no email address.' };
  }

  const firstName = escapeHtml(input.firstName?.trim() || 'Client');
  const labels = files.map((file) => file.label).join(' and ');
  const subject = 'Your initial disclosure and privacy notice';
  const body = `Please find attached your ${labels}. These explain our services and how we handle your personal information.`;
  const html = `<p>Dear ${firstName},</p><p>Please find attached your <strong>${escapeHtml(labels)}</strong>. These explain our services and how we handle your personal information.</p>`;

  const sent = await sendComplianceEmail({
    orgId: input.orgId,
    caseId: input.caseId,
    clientId: input.clientId,
    to: email,
    subject,
    body,
    html,
    stage: 1,
    attachments: files.map((file) => ({ filename: file.storedName, content: file.content })),
  });
  if (!sent) {
    return { sent: false, documents, error: 'The disclosure email could not be delivered.' };
  }

  void logAuditEvent({
    orgId: input.orgId,
    userId: input.userId,
    entityType: 'Case',
    entityId: input.caseId,
    action: 'CLIENT_DOCUMENT_SENT',
    diff: { after: { templates: documents, trigger: 'establish' } },
  });

  return { sent: true, documents };
}

const MANUAL_COPY: Partial<Record<ClientTemplateId, { subject: string; body: string }>> = {
  idd: {
    subject: 'Your initial disclosure',
    body: 'Please find attached your initial disclosure. It explains our services, costs, and regulatory status.',
  },
  privacy: {
    subject: 'Your customer privacy notice',
    body: 'Please find attached your customer privacy notice. It explains how we use your personal information.',
  },
  tob: {
    subject: 'Your terms of business',
    body: 'Please find attached our terms of business for your mortgage case.',
  },
  survey: {
    subject: 'We would like your feedback',
    body: 'Please find attached a short feedback survey about the service you received. Your comments help us check that we are delivering a good outcome.',
  },
};

export async function sendCaseClientDocument(input: {
  orgId: string;
  caseId: string;
  template: ClientTemplateId;
  userId?: string;
  origin?: string;
}): Promise<SendClientDocumentResult> {
  if (input.template === 'esis' || input.template === 'research') {
    const illustration = await generateCaseIllustration({
      orgId: input.orgId,
      caseId: input.caseId,
      kind: input.template,
      userId: input.userId,
      deliver: true,
    });
    if (!illustration.ok) {
      const code = illustration.code === 'INCOMPLETE' ? 'UNAVAILABLE' : illustration.code;
      return { ok: false, code, message: illustration.message };
    }
    return { ok: true, template: input.template, documentName: illustration.documentName };
  }

  if (input.template === 'survey') {
    const survey = await sendCaseSurveyLink({
      orgId: input.orgId,
      caseId: input.caseId,
      userId: input.userId,
      origin: input.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
    });
    if (!survey.ok) return { ok: false, code: survey.code, message: survey.message };
    return { ok: true, template: 'survey', documentName: 'Client Feedback Survey sent.txt' };
  }

  const file = await readClientTemplate(input.template);
  if (!file) {
    return {
      ok: false,
      code: 'UNAVAILABLE',
      message: 'That template is not in the document library yet.',
    };
  }

  const recipient = await loadCaseRecipient(input.orgId, input.caseId);
  if ('error' in recipient) {
    if (recipient.error === 'NOT_FOUND') {
      return { ok: false, code: 'NOT_FOUND', message: 'Case not found' };
    }
    return { ok: false, code: 'NO_EMAIL', message: 'This client has no email address.' };
  }

  const copy = MANUAL_COPY[input.template] ?? {
    subject: file.label,
    body: `Please find attached your ${file.label}.`,
  };
  const firstName = escapeHtml(recipient.firstName);
  const sent = await sendComplianceEmail({
    orgId: input.orgId,
    caseId: input.caseId,
    clientId: recipient.caseRecord.clientId,
    to: recipient.email,
    subject: copy.subject,
    body: copy.body,
    html: `<p>Dear ${firstName},</p><p>${escapeHtml(copy.body)}</p>`,
    attachments: [{ filename: file.storedName, content: file.content }],
  });
  if (!sent) {
    return { ok: false, code: 'DELIVERY_FAILED', message: 'The email could not be delivered.' };
  }

  try {
    await fileSentTemplate({
      orgId: input.orgId,
      caseId: input.caseId,
      clientId: recipient.caseRecord.clientId,
      userId: input.userId,
      template: file.id,
      storedName: file.storedName,
      mimeType: file.mimeType,
      content: file.content,
    });
  } catch (error) {
    console.error('[sendCaseClientDocument] could not file', file.id, error);
  }

  void logAuditEvent({
    orgId: input.orgId,
    userId: input.userId,
    entityType: 'Case',
    entityId: input.caseId,
    action: 'CLIENT_DOCUMENT_SENT',
    diff: { after: { template: file.id, name: file.storedName } },
  });

  return { ok: true, template: file.id, documentName: file.storedName };
}
