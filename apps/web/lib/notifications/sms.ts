/**
 * SMS delivery via Twilio (platform credentials in env).
 */

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SendSmsResult =
  | { ok: true; sid?: string }
  | { ok: false; error: string };

export async function sendSMS(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!accountSid || !authToken) {
    return { ok: false, error: 'Twilio credentials are not configured on the server' };
  }
  if (!from) {
    return { ok: false, error: 'TWILIO_FROM_NUMBER is not configured on the server' };
  }

  try {
    const params = new URLSearchParams({
      To: input.to,
      From: from,
      Body: input.body,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    const payload = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };

    if (!res.ok) {
      const detail = payload.message ?? res.statusText;
      console.error('[sendSMS] Twilio error:', res.status, detail);
      return { ok: false, error: detail || 'SMS delivery failed' };
    }

    return { ok: true, sid: payload.sid };
  } catch (error) {
    console.error('[sendSMS]', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'SMS delivery failed',
    };
  }
}

export async function sendComplianceSMS(params: {
  orgId: string;
  caseId: string;
  clientId: string;
  to: string;
  body: string;
  sourceType?: 'COMPLIANCE' | 'AI_REPORT' | 'CASE_UPDATE' | 'SYSTEM';
}): Promise<boolean> {
  const { orgId, caseId, clientId, to, body, sourceType = 'COMPLIANCE' } = params;
  const result = await sendSMS({ to, body });
  if (!result.ok) return false;

  try {
    const { prisma } = await import('@/lib/db');
    await prisma.message.create({
      data: {
        orgId,
        caseId,
        clientId,
        direction: 'OUTBOUND',
        channel: 'SMS',
        sourceType,
        body,
      },
    });
  } catch (err) {
    console.error('[sendComplianceSMS] Failed to record message:', err);
  }

  return true;
}

export async function sendSMSWelcomeNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  phone: string,
) {
  return sendComplianceSMS({
    orgId,
    caseId,
    clientId,
    to: phone,
    body: 'Welcome to KO Broker. Your case is now open in our system. We have sent the initial disclosure to your email.',
  });
}

export async function sendSMSFactFindConfirmation(
  orgId: string,
  caseId: string,
  clientId: string,
  phone: string,
) {
  return sendComplianceSMS({
    orgId,
    caseId,
    clientId,
    to: phone,
    body: 'KO Broker: Your Fact-Find is complete. We are beginning research for your mortgage options.',
  });
}

export async function sendSMSResearchUpdate(
  orgId: string,
  caseId: string,
  clientId: string,
  phone: string,
) {
  return sendComplianceSMS({
    orgId,
    caseId,
    clientId,
    to: phone,
    body: 'KO Broker: Research is complete on your mortgage options. We are preparing the ESIS document.',
  });
}

export async function sendSMSEsisNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  phone: string,
) {
  return sendComplianceSMS({
    orgId,
    caseId,
    clientId,
    to: phone,
    body: 'KO Broker: Your ESIS document is ready for review. Please check your email/portal.',
  });
}

export async function sendSMSRecommendationNotification(
  orgId: string,
  caseId: string,
  clientId: string,
  phone: string,
) {
  return sendComplianceSMS({
    orgId,
    caseId,
    clientId,
    to: phone,
    body: 'KO Broker: Your Suitability Report is ready. We have emailed the final recommendation report to you.',
    sourceType: 'AI_REPORT',
  });
}
