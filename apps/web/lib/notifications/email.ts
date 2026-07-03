/**
 * Email delivery via Resend (platform credentials in env).
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = input.from?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
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
        ...(replyTo ? { reply_to: replyTo } : {}),
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

export async function sendComplianceEmail(params: {
  orgId: string;
  caseId: string;
  clientId: string;
  to: string;
  subject: string;
  body: string;
  sourceType?: 'COMPLIANCE' | 'AI_REPORT' | 'CASE_UPDATE' | 'SYSTEM';
}): Promise<boolean> {
  const { orgId, caseId, clientId, to, subject, body, sourceType = 'COMPLIANCE' } = params;
  const result = await sendEmail({ to, subject, body });
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
  return sendComplianceEmail({
    orgId,
    caseId,
    clientId,
    to: email,
    subject: 'Welcome to KO Broker — Initial Disclosure Document',
    body: 'Welcome to KO Broker. We are pleased to assist you with your mortgage case. Please review the attached Initial Disclosure Document (IDD) to get started.',
  });
}

export async function sendFactFindConfirmation(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  return sendComplianceEmail({
    orgId,
    caseId,
    clientId,
    to: email,
    subject: 'Your Fact-Find is Complete',
    body: 'Thank you for completing your fact-find questionnaire. Your adviser is reviewing the information and will start researching suitable mortgage products.',
  });
}

export async function sendResearchUpdate(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  return sendComplianceEmail({
    orgId,
    caseId,
    clientId,
    to: email,
    subject: 'Case Update: Research Complete',
    body: 'Our research into the best mortgage products for your case is now complete. We have narrowed down the options and will prepare the ESIS document next.',
  });
}

export async function sendEsisNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  return sendComplianceEmail({
    orgId,
    caseId,
    clientId,
    to: email,
    subject: 'Your European Standardised Information Sheet (ESIS) is Ready',
    body: 'Your ESIS document is ready for review. This contains all key financial details and terms for the recommended mortgage product.',
  });
}

export async function sendRecommendationNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  email: string,
) {
  return sendComplianceEmail({
    orgId,
    caseId,
    clientId,
    to: email,
    subject: 'Your Suitability Report and Recommendation',
    body: 'We have finalized our recommendation for your mortgage. Please find the complete Suitability Report detailing our reasoning and selection.',
    sourceType: 'AI_REPORT',
  });
}
