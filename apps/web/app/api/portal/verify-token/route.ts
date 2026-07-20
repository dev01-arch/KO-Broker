import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { VerifyPortalTokenSchema } from '@ko/types';
import { verifyPortalToken } from '@/lib/api/portal-data';
import { applyCorsHeaders } from '@/lib/api/cors';

export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  schema: VerifyPortalTokenSchema,
  handler: async (req: NextRequest, { body }) => {
    const result = await verifyPortalToken(body.token);

    if ('error' in result) {
      return applyCorsHeaders(
        req,
        NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invalid or expired invite token' },
          },
          { status: 404 },
        ),
      );
    }

    return applyCorsHeaders(
      req,
      NextResponse.json({ success: true, data: result }, { status: 200 }),
    );
  },
});
