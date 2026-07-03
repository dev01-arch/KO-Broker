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
}

/**
 * POST /api/webhooks/email
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

  const body = await req.text();
  const headerPayload = await headers();

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

  const client = await prisma.client.findFirst({
    where: { email: senderEmail },
    orderBy: { createdAt: 'desc' },
  });

  if (!client) {
    console.warn(`[Inbound Email Webhook] Sender ${senderEmail} not found in database.`);
    return NextResponse.json({ success: true, warning: 'Sender not found as a Client' }, { status: 202 });
  }

  const caseRecord = await prisma.case.findFirst({
    where: { clientId: client.id },
    orderBy: { updatedAt: 'desc' },
  });

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
