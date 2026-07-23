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
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  // Get the body as raw text
  // IMPORTANT: We must use req.text() instead of req.json() to preserve the exact raw string.
  // Using JSON.stringify(await req.json()) breaks the cryptographic signature!
  const body = await req.text();

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response(`Error occured: ${err instanceof Error ? err.message : 'Unknown verification error'}`, {
      status: 400,
    });
  }

  const eventType = evt.type as string;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name } = evt.data as unknown as UserCreatedData;
    const email = email_addresses[0]?.email_address;

    if (!email) {
      return new Response('Error occured -- no email address', {
        status: 400,
      });
    }

    // Check if there is an existing pending invite user with this email
    const existingPendingUser = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        invitePending: true,
      },
    });

    if (existingPendingUser) {
      // Link the Clerk ID, but keep the names entered on the platform invite form.
      // Only fill blanks from Clerk — never overwrite invite first/last name.
      // The browser-side accept-invite route will clear the token when it processes it.
      await prisma.user.update({
        where: { id: existingPendingUser.id },
        data: {
          clerkId: id,
          firstName: existingPendingUser.firstName || first_name,
          lastName: existingPendingUser.lastName || last_name,
        },
      });
    } else {
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
  }

  if (eventType === 'organization.created') {
    const { id, name, slug } = evt.data as unknown as OrganizationCreatedData;

    await prisma.organisation.upsert({
      where: { id: id },
      update: {
        name,
        slug: slug || id
      },
      create: {
        id: id,
        name: name,
        slug: slug || id,
        plan: 'STARTER',
      },
    });
  }

  if (eventType === 'organizationMembership.created') {
    const { organization, public_user_data } = evt.data as unknown as OrganizationMembershipCreatedData;
    const clerkUserId = public_user_data.user_id;
    const clerkOrgId = organization.id;

    // Link user to organisation
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
