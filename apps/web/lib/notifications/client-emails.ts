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
  const subject = `Welcome to KO Platform — ${client.referenceNumber}`;
  const body = [
    `Hi ${clientName},`,
    '',
    'Your mortgage adviser has added you as a client on KO Platform.',
    '',
    `Your client reference is ${client.referenceNumber}.`,
    '',
    'You will receive a separate invitation when your adviser is ready for you to complete your fact-find in the client portal.',
    '',
    'If you have any questions, please contact your adviser directly.',
  ].join('\n');
  const html = `
    <p>Hi ${clientName},</p>
    <p>Your mortgage adviser has added you as a client on <strong>KO Platform</strong>.</p>
    <p>Your client reference is <strong>${client.referenceNumber}</strong>.</p>
    <p>You will receive a separate invitation when your adviser is ready for you to complete your fact-find in the client portal.</p>
    <p>If you have any questions, please contact your adviser directly.</p>
  `;

  const result = await sendEmail({
    to: client.email,
    subject,
    body,
    html,
    from: formatFromAddress(),
  });

  if (result.ok) return { sent: true };
  return { sent: false, error: result.error };
}

/** Notify the assigned adviser that a new client has been created for them. */
export async function sendAdviserClientAssignedEmail(input: {
  adviser: { email: string; firstName: string; lastName: string };
  client: {
    email: string;
    firstName: string;
    lastName: string;
    referenceNumber: string;
    companyName?: string | null;
    clientType?: string;
  };
}): Promise<EmailDeliveryStatus> {
  const adviserName =
    [input.adviser.firstName, input.adviser.lastName].filter(Boolean).join(' ').trim() ||
    'Adviser';
  const clientName =
    input.client.clientType === 'COMPANY' && input.client.companyName?.trim()
      ? input.client.companyName.trim()
      : `${input.client.firstName} ${input.client.lastName}`.trim();
  const subject = `New client assigned — ${input.client.referenceNumber}`;
  const body = [
    `Hi ${adviserName},`,
    '',
    `A new client has been assigned to you on KO Platform.`,
    '',
    `Client: ${clientName}`,
    `Email: ${input.client.email}`,
    `Reference: ${input.client.referenceNumber}`,
    '',
    'You can open their record from your Clients list on the dashboard.',
    '',
    'Best regards,',
    'KO Platform',
  ].join('\n');
  const html = `
    <p>Hi ${adviserName},</p>
    <p>A new client has been assigned to you on <strong>KO Platform</strong>.</p>
    <p>
      <strong>Client:</strong> ${clientName}<br/>
      <strong>Email:</strong> ${input.client.email}<br/>
      <strong>Reference:</strong> ${input.client.referenceNumber}
    </p>
    <p>You can open their record from your Clients list on the dashboard.</p>
    <p>Best regards,<br/>KO Platform</p>
  `;

  const result = await sendEmail({
    to: input.adviser.email,
    subject,
    body,
    html,
    from: formatFromAddress(),
  });

  if (result.ok) return { sent: true };
  return { sent: false, error: result.error };
}
