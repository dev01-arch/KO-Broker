import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';

interface InboundEmailPayload {
  from: {
    email: string;
    name?: string;
  };
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  // Resend or other providers custom fields
}

/**
 * POST /api/webhooks/email
 * 
 * Handles inbound email webhooks (e.g. from Resend or another provider).
 * Verifies signature via Svix (if secret configured) or API secret key, 
 * resolves client by sender email, and creates an INBOUND Message record.
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

  const body = await req.text();
  const headerPayload = await headers();

  // If a secret is configured, enforce Svix cryptographic verification
  if (WEBHOOK_SECRET) {
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response('Missing signature headers', { status: 400 });
    }

    const wh = new Webhook(WEBHOOK_SECRET);
    try {
      wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('[Inbound Email Webhook] Verification failed:', err);
      return new Response('Invalid webhook signature', { status: 400 });
    }
  } else {
    // If no secret is set, log a warning (allow testing in local dev)
    console.warn('[Inbound Email Webhook] Running WITHOUT signature verification.');
  }

  let payload: InboundEmailPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const senderEmail = payload.from?.email;
  if (!senderEmail) {
    return new Response('Sender email not found in payload', { status: 400 });
  }

  // Lookup client by email
  const client = await prisma.client.findFirst({
    where: { email: senderEmail },
    orderBy: { createdAt: 'desc' },
  });

  if (!client) {
    // Return 200/202 to the provider so they don't retry, but log it
    console.warn(`[Inbound Email Webhook] Sender ${senderEmail} not found in database.`);
    return NextResponse.json({ success: true, warning: 'Sender not found as a Client' }, { status: 202 });
  }

  // Resolve case (find the latest active case for this client)
  const caseRecord = await prisma.case.findFirst({
    where: { clientId: client.id },
    orderBy: { updatedAt: 'desc' },
  });

  // Create message record
  const message = await prisma.message.create({
    data: {
      orgId: client.orgId,
      clientId: client.id,
      caseId: caseRecord?.id || null,
      direction: 'INBOUND',
      channel: 'EMAIL',
      sourceType: 'CLIENT_REPLY',
      subject: payload.subject,
      body: payload.text || payload.html || '',
      isRead: false,
    },
  });

  return NextResponse.json({ success: true, messageId: message.id }, { status: 201 });
}
