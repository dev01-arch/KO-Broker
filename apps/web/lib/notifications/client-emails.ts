import { sendEmail } from '@/lib/notifications/email';

export type EmailDeliveryStatus = {
  sent: boolean;
  error?: string;
};

function formatFromAddress(): string {
  const email = process.env.RESEND_FROM_EMAIL?.trim();
  if (!email) return '';
  const name = process.env.RESEND_FROM_NAME?.trim() || 'KO Platform';
  return email.includes('<') ? email : `${name} <${email}>`;
}

export async function sendClientWelcomeEmail(client: {
  email: string;
  firstName: string;
  lastName: string;
  referenceNumber: string;
}): Promise<EmailDeliveryStatus> {
  const clientName = `${client.firstName} ${client.lastName}`.trim();

  const result = await sendEmail({
    to: client.email,
    subject: `Welcome to KO Platform — ${client.referenceNumber}`,
    body: [
      `Hi ${clientName},`,
      '',
      'Your mortgage adviser has added you as a client on KO Platform.',
      '',
      `Your client reference is ${client.referenceNumber}.`,
      '',
      'You will receive a separate invitation when your adviser is ready for you to complete your fact-find in the client portal.',
      '',
      'If you have any questions, please contact your adviser directly.',
    ].join('\n'),
    from: formatFromAddress(),
  });

  if (result.ok) return { sent: true };
  return { sent: false, error: result.error };
}
