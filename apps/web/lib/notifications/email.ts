/**
 * Email delivery via Resend (platform credentials in env).
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

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
