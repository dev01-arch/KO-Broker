/**
 * Email delivery via Resend (platform credentials in env).
 */

import { renderBaseTemplate, plainBodyToHtml } from '@/lib/notifications/email-template';

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  html?: string;
  stage?: number;
  attachments?: EmailAttachment[];
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function resolveFromAddress(from?: string): string | undefined {
  return from?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
}

function buildHtmlPayload(input: SendEmailInput): string {
  const fragment = input.html ?? plainBodyToHtml(input.body);
  return renderBaseTemplate(input.subject, fragment, input.stage);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = resolveFromAddress(input.from);
  const replyTo = input.replyTo?.trim() || process.env.RESEND_REPLY_TO?.trim();

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not configured on the server' };
  }
  if (!from) {
    return { ok: false, error: 'RESEND_FROM_EMAIL is not configured on the server' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.body,
        html: buildHtmlPayload(input),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content.toString('base64'),
              })),
            }
          : {}),
      }),
    });

    const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!res.ok) {
      const detail = payload.message ?? res.statusText;
      console.error('[sendEmail] Resend error:', res.status, detail);
      return { ok: false, error: detail || 'Email delivery failed' };
    }

    return { ok: true, id: payload.id };
  } catch (error) {
    console.error('[sendEmail]', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Email delivery failed',
    };
  }
}

/** Delivery-only email — does not create a DB Message record. */
export async function deliverEmail(input: SendEmailInput): Promise<boolean> {
  const result = await sendEmail(input);
  return result.ok;
}

async function resolveClientFirstName(clientId: string): Promise<string> {
  try {
    const { prisma } = await import('@/lib/db');
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { firstName: true },
    });
    return client?.firstName ?? 'Client';
  } catch {
    return 'Client';
  }
}

export async function sendComplianceEmail(params: {
  orgId: string;
  caseId: string;
  clientId: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  stage?: number;
  sourceType?: 'COMPLIANCE' | 'AI_REPORT' | 'CASE_UPDATE' | 'SYSTEM';
  attachments?: EmailAttachment[];
}): Promise<boolean> {
  const {
    orgId,
    caseId,
    clientId,
    to,
    subject,
    body,
    html,
    stage,
    sourceType = 'COMPLIANCE',
    attachments,
  } = params;
  const result = await sendEmail({ to, subject, body, html, stage, attachments });
  if (!result.ok) return false;

  try {
    const { prisma } = await import('@/lib/db');
    await prisma.message.create({
      data: {
        orgId,
        caseId,
        clientId,
        direction: 'OUTBOUND',
        channel: 'EMAIL',
        sourceType,
        subject,
        body,
      },
    });
  } catch (err) {
    console.error('[sendComplianceEmail] Failed to record message:', err);
  }

  return true;
}

export async function sendWelcomeNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  const firstName = await resolveClientFirstName(clientId);
  const subject = 'Welcome to KO Broker — Initial Disclosure Document';
  const body =
    'Welcome to KO Broker. We are pleased to assist you with your mortgage case. Please review the attached Initial Disclosure Document (IDD) to get started.';
  const html = `
        <p>Dear ${firstName},</p>
        <p>Welcome to <strong>KO Broker</strong>. We are pleased to assist you with your mortgage journey.</p>
        <p>Please review the attached <strong>Initial Disclosure Document (IDD)</strong> to get started. This document outlines our services, fees, and regulatory status.</p>
        <p>Our team is dedicated to finding the most suitable mortgage options for your unique financial situation. If you have any questions, you can contact your adviser directly through our portal.</p>
    `;

  return sendComplianceEmail({ orgId, caseId, clientId, to: email, subject, body, html, stage: 1 });
}

export async function sendFactFindConfirmation(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  const firstName = await resolveClientFirstName(clientId);
  const subject = 'Your Fact-Find is Complete';
  const body =
    'Thank you for completing your fact-find questionnaire. Your adviser is reviewing the information and will start researching suitable mortgage products.';
  const html = `
        <p>Dear ${firstName},</p>
        <p>Thank you for completing your <strong>Fact-Find questionnaire</strong>.</p>
        <p>Your adviser has been notified and is currently reviewing the details provided. We will begin researching the market for the most suitable mortgage products tailored to your requirements.</p>
        <p>We will keep you updated as your case progresses.</p>
    `;

  return sendComplianceEmail({ orgId, caseId, clientId, to: email, subject, body, html, stage: 2 });
}

export async function sendResearchUpdate(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  const firstName = await resolveClientFirstName(clientId);
  const subject = 'Case Update: Research Complete';
  const body =
    'Our research into the best mortgage products for your case is now complete. We have narrowed down the options and will prepare the ESIS document next.';
  const html = `
        <p>Dear ${firstName},</p>
        <p>We are pleased to inform you that our research stage is now complete.</p>
        <p>After analyzing the market, we have identified the most suitable mortgage products for your circumstances. The next step is preparing your <strong>European Standardised Information Sheet (ESIS)</strong>, which details the exact terms of the recommended products.</p>
    `;

  return sendComplianceEmail({ orgId, caseId, clientId, to: email, subject, body, html, stage: 3 });
}

export async function sendEsisNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  const firstName = await resolveClientFirstName(clientId);
  const subject = 'Your European Standardised Information Sheet (ESIS) is Ready';
  const body =
    'Your ESIS document is ready for review. This contains all key financial details and terms for the recommended mortgage product.';
  const html = `
        <p>Dear ${firstName},</p>
        <p>Your <strong>European Standardised Information Sheet (ESIS)</strong> is now ready for your review.</p>
        <p>This document details the key terms, monthly payments, interest rates, and fees associated with our recommended mortgage. Please log in to your portal to review it at your convenience.</p>
    `;

  return sendComplianceEmail({ orgId, caseId, clientId, to: email, subject, body, html, stage: 4 });
}

export async function sendRecommendationNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
  pdfBuffer?: Buffer,
) {
  const firstName = await resolveClientFirstName(clientId);
  const subject = 'Your Suitability Report and Recommendation';
  const body =
    'We have finalized our recommendation for your mortgage. Please find attached the complete Suitability Report detailing our reasoning and selection.';
  const html = `
        <p>Dear ${firstName},</p>
        <p>We have finalized our mortgage recommendation for you.</p>
        <p>Please find attached your comprehensive <strong>Suitability Report</strong>, which outlines our final recommendation and details why we believe this product is the best fit for your needs.</p>
        <p>We look forward to proceeding with your application.</p>
    `;
  const attachments = pdfBuffer
    ? [{ filename: 'Suitability_Report.pdf', content: pdfBuffer }]
    : undefined;

  return sendComplianceEmail({
    orgId,
    caseId,
    clientId,
    to: email,
    subject,
    body,
    html,
    sourceType: 'AI_REPORT',
    attachments,
    stage: 5,
  });
}
