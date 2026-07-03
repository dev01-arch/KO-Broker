import { NextRequest } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

interface UserCreatedData {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
}

interface OrganizationCreatedData {
  id: string;
  name: string;
  slug: string | null;
}

interface OrganizationMembershipCreatedData {
  organization: { id: string };
  public_user_data: { user_id: string };
}

/**
 * POST /api/webhooks/clerk
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'CLERK_WEBHOOK_SECRET is not configured',
        },
      },
      { status: 503 },
    );
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response(
      `Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      { status: 400 },
    );
  }

  const eventType = evt.type as string;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data as unknown as UserCreatedData;
    const email = email_addresses[0]?.email_address;

    if (!email) {
      return new Response('No email address in payload', { status: 400 });
    }

    await prisma.user.upsert({
      where: { clerkId: id },
      update: {
        email,
        firstName: first_name,
        lastName: last_name,
      },
      create: {
        clerkId: id,
        email,
        firstName: first_name,
        lastName: last_name,
        role: 'ADVISER',
      },
    });
  }

  if (eventType === 'organization.created') {
    const { id, name, slug } = evt.data as unknown as OrganizationCreatedData;

    await prisma.organisation.upsert({
      where: { id },
      update: {
        name,
        slug: slug || id,
      },
      create: {
        id,
        name,
        slug: slug || id,
        plan: 'STARTER',
      },
    });
  }

  if (eventType === 'organizationMembership.created') {
    const { organization, public_user_data } =
      evt.data as unknown as OrganizationMembershipCreatedData;
    const clerkUserId = public_user_data.user_id;
    const clerkOrgId = organization.id;

    const org = await prisma.organisation.findUnique({
      where: { id: clerkOrgId },
    });

    if (org) {
      await prisma.user.update({
        where: { clerkId: clerkUserId },
        data: {
          orgId: org.id,
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
