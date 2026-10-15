import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { prisma } from '@/lib/db';
import { createDocumentForOrg } from '@/lib/api/documents-data';
import { logAuditEvent } from '@/lib/compliance/audit';
import { IllustrationDocument } from '@/components/pdf/IllustrationDocument';
import {
  buildEsisSections,
  buildResearchSections,
  type EsisProductInput,
  type ResearchPackInput,
} from '@/lib/documents/illustration-content';
import { sendComplianceEmail } from '@/lib/notifications/email';
import { uploadToR2 } from '@/lib/storage/r2';

export type IllustrationKind = 'esis' | 'research';

export type IllustrationResult =
  | { ok: true; documentName: string; sent: boolean }
  | { ok: false; code: 'NOT_FOUND' | 'NO_EMAIL' | 'INCOMPLETE' | 'DELIVERY_FAILED'; message: string };

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export async function generateCaseIllustration(input: {
  orgId: string;
  caseId: string;
  kind: IllustrationKind;
  userId?: string;
  deliver?: boolean;
}): Promise<IllustrationResult> {
  const caseRecord = await prisma.case.findFirst({
    where: { id: input.caseId, orgId: input.orgId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, email: true } },
      adviser: { select: { firstName: true, lastName: true } },
      productsConsidered: true,
      organisation: { select: { name: true } },
    },
  });
  if (!caseRecord) return { ok: false, code: 'NOT_FOUND', message: 'Case not found' };

  const clientName = [caseRecord.client.firstName, caseRecord.client.lastName].filter(Boolean).join(' ') || 'Client';
  const adviserName = [caseRecord.adviser?.firstName, caseRecord.adviser?.lastName].filter(Boolean).join(' ');
  const firmName = caseRecord.organisation?.name || 'Your adviser';
  const generatedOn = todayLabel();
  const selected = caseRecord.productsConsidered.find((product) => product.isSelected);

  let title = '';
  let documentName = '';
  let sections;
  if (input.kind === 'esis') {
    const source: EsisProductInput = {
      firmName,
      adviserName,
      clientName,
      referenceNumber: caseRecord.referenceNumber,
      generatedOn,
      loanAmount: num(caseRecord.loanAmount),
      propertyValue: num(caseRecord.propertyValue),
      termYears: caseRecord.termYears,
      lenderName: selected?.lenderName || caseRecord.selectedLender || null,
      productName: selected?.productName || caseRecord.selectedProduct || null,
      rate: num(selected?.rate) ?? num(caseRecord.selectedRate),
      fee: num(selected?.fee) ?? num(caseRecord.selectedFee),
      monthlyPayment: num(caseRecord.monthlyPayment),
      rateType: caseRecord.rateType,
      initialTermMonths: selected?.initialTermMonths ?? null,
      ercSummary: selected?.ercSummary || null,
    };
    const built = buildEsisSections(source);
    if (!built.ok) return { ok: false, code: 'INCOMPLETE', message: built.message };
    sections = built.sections;
    title = 'European Standardised Information Sheet';
    documentName = 'ESIS illustration.pdf';
  } else {
    const source: ResearchPackInput = {
      firmName,
      clientName,
      referenceNumber: caseRecord.referenceNumber,
      generatedOn,
      products: caseRecord.productsConsidered.map((product) => ({
        lenderName: product.lenderName,
        productName: product.productName,
        rate: num(product.rate),
        fee: num(product.fee),
        isSelected: product.isSelected,
        reasonNotSelected: product.reasonNotSelected,
      })),
    };
    const built = buildResearchSections(source);
    if (!built.ok) return { ok: false, code: 'INCOMPLETE', message: built.message };
    sections = built.sections;
    title = 'Research pack';
    documentName = 'Research pack.pdf';
  }

  const buffer = await renderToBuffer(
    React.createElement(IllustrationDocument, {
      title,
      subtitle: `${firmName} · ${caseRecord.referenceNumber} · ${generatedOn}`,
      sections,
    }) as unknown as React.ReactElement<import('@react-pdf/renderer').DocumentProps>,
  );

  const email = caseRecord.client.email?.trim();
  if (input.deliver) {
    if (!email) return { ok: false, code: 'NO_EMAIL', message: 'This client has no email address.' };
    const sent = await sendComplianceEmail({
      orgId: input.orgId,
      caseId: caseRecord.id,
      clientId: caseRecord.client.id,
      to: email,
      subject: title,
      body: `Please find attached your ${title}.`,
      html: `<p>Dear ${clientName},</p><p>Please find attached your <strong>${title}</strong>.</p>`,
      attachments: [{ filename: documentName, content: Buffer.from(buffer) }],
    });
    if (!sent) return { ok: false, code: 'DELIVERY_FAILED', message: 'The email could not be delivered.' };
  }

  const key = `orgs/${input.orgId}/cases/${caseRecord.id}/illustrations/${input.kind}-${Date.now()}.pdf`;
  const storageUrl = await uploadToR2(Buffer.from(buffer), key, 'application/pdf');
  await createDocumentForOrg(input.orgId, {
    name: documentName,
    documentType: 'COMPLIANCE',
    caseId: caseRecord.id,
    clientId: caseRecord.client.id,
    storageUrl,
    mimeType: 'application/pdf',
    sizeBytes: buffer.byteLength,
    uploadedBy: input.userId,
  });

  void logAuditEvent({
    orgId: input.orgId,
    userId: input.userId,
    entityType: 'Case',
    entityId: caseRecord.id,
    action: 'CLIENT_DOCUMENT_SENT',
    diff: { after: { kind: input.kind, documentName, emailed: Boolean(input.deliver) } },
  });

  return { ok: true, documentName, sent: Boolean(input.deliver) };
}
