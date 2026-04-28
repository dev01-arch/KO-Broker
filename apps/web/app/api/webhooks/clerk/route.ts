import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/webhooks/clerk
 *
 * Clerk webhook handler — PRD-04
 *
 * Handles:
 * - user.created → create/upsert User record in DB
 * - organization.created → create Organisation with plan: STARTER
 * - organization_membership.created → upsert User-Organisation link
 *
 * All payloads are verified using svix signature headers.
 */
export async function POST(req: NextRequest) {
  // TODO (PRD-04): Implement svix signature verification
  // TODO (PRD-04): Handle user.created, organization.created, organization_membership.created

  return NextResponse.json(
    { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Webhook handler not yet implemented' } },
    { status: 501 }
  );
}
