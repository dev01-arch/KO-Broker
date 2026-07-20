import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { SetupClientPortalSchema } from '@ko/types';
import { setupPortalAccount } from '@/lib/api/portal-data';
import { portalSessionCookieOptions } from '@/lib/api/portal-session';
import { applyCorsHeaders } from '@/lib/api/cors';

export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  schema: SetupClientPortalSchema,
  handler: async (req: NextRequest, { body }) => {
    const result = await setupPortalAccount(body.token, body.password);

    if ('error' in result) {
      if (result.error === 'ALREADY_CONFIGURED') {
        return applyCorsHeaders(
          req,
          NextResponse.json(
            {
              success: false,
              error: {
                code: 'ACCOUNT_ALREADY_CONFIGURED',
                message: 'This portal account is already set up. Please sign in instead.',
              },
            },
            { status: 409 },
          ),
        );
      }

      if (result.error === 'FORBIDDEN') {
        return applyCorsHeaders(
          req,
          NextResponse.json(
            {
              success: false,
              error: { code: 'FORBIDDEN', message: 'No case linked to this portal account' },
            },
            { status: 403 },
          ),
        );
      }

      if (result.error === 'SERVICE_UNAVAILABLE') {
        return applyCorsHeaders(
          req,
          NextResponse.json(
            {
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Portal is temporarily unavailable. Please try again.',
              },
            },
            { status: 503 },
          ),
        );
      }

      return applyCorsHeaders(
        req,
        NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Invalid or expired setup token' },
          },
          { status: 404 },
        ),
      );
    }

    const { client, sessionToken } = result;
    const response = NextResponse.json(
      {
        success: true,
        data: {
          success: true,
          clientId: client.id,
          message: 'Account configured successfully.',
        },
      },
      { status: 200 },
    );

    response.cookies.set(portalSessionCookieOptions(sessionToken));
    return applyCorsHeaders(req, response);
  },
});
