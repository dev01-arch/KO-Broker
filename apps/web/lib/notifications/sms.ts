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
