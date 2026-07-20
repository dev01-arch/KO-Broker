import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { z } from 'zod';
import { inviteClientToPortal } from '@/lib/api/portal-data';

const InviteSchema = z.object({
  caseId: z.string().min(1, 'Case ID is required'),
});

/**
 * POST /api/portal/invite
 * Backend createHandler shape; delivery via inviteClientToPortal (email status + plan gate).
 */
export const POST = createHandler({
  method: 'POST',
  requiredFeature: 'client_portal',
  schema: InviteSchema,
  handler: async (_req: NextRequest, { body, user, orgId }) => {
    // === FRONTEND ADDITION: inviteClientToPortal (compatible email API + notifications meta) ===
    const result = await inviteClientToPortal(orgId!, body.caseId, user!.id);
    if ('error' in result) {
      const status =
        result.error === 'NOT_FOUND' ? 404 : result.error === 'FORBIDDEN' ? 403 : 500;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error,
            message:
              result.error === 'NOT_FOUND'
                ? 'Case not found'
                : result.error === 'FORBIDDEN'
                  ? 'Client portal is not available on your plan'
                  : 'Failed to send invite',
          },
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Onboarding invitation sent successfully.',
        data: result,
      },
      { status: 201 }
    );
    // === END FRONTEND ADDITION ===
  },
});
