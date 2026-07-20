import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { requirePortalAuth } from '@/lib/auth/portalAuth';
import { z } from 'zod';
import { listPortalMessages, sendPortalMessage } from '@/lib/api/portal-data';
import type { PortalSessionPayload } from '@/lib/api/portal-session';

const SendMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required'),
});

function sessionFromClient(client: Awaited<ReturnType<typeof requirePortalAuth>>): PortalSessionPayload | null {
  const activeCase = client.cases[0];
  if (!activeCase) return null;
  return {
    clientId: client.id,
    orgId: client.orgId,
    caseId: activeCase.id,
    email: client.email,
  };
}

export const GET = createHandler({
  method: 'GET',
  requireAuth: false,
  handler: async () => {
    const client = await requirePortalAuth();
    const session = sessionFromClient(client);

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active case found' } },
        { status: 404 }
      );
    }

    // === FRONTEND ADDITION: portal-data list (consistent serializers) ===
    const messages = await listPortalMessages(session);
    // === END FRONTEND ADDITION ===

    return NextResponse.json({ success: true, data: messages }, { status: 200 });
  },
});

export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  schema: SendMessageSchema,
  handler: async (_req: NextRequest, { body }) => {
    const client = await requirePortalAuth();
    const session = sessionFromClient(client);

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No active case found' } },
        { status: 404 }
      );
    }

    // === FRONTEND ADDITION: sendPortalMessage (adviser digest notifications) ===
    const result = await sendPortalMessage(session, body.body);
    // === END FRONTEND ADDITION ===

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  },
});
