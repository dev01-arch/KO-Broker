import { NextRequest, NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { LoginClientPortalSchema } from '@ko/types';
import { loginPortalClient } from '@/lib/api/portal-data';
import { portalSessionCookieOptions } from '@/lib/api/portal-session';

export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  schema: LoginClientPortalSchema,
  handler: async (_req: NextRequest, { body }) => {
    const result = await loginPortalClient(body.email, body.password);

    if ('error' in result) {
      if (result.error === 'FORBIDDEN') {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: 'No case linked to this portal account' },
          },
          { status: 403 },
        );
      }

      if (result.error === 'SETUP_REQUIRED') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'PORTAL_SETUP_REQUIRED',
              message:
                'Your portal password is not set up yet. Please open the invite link from your adviser to create or reset your password.',
            },
          },
          { status: 403 },
        );
      }

      if (result.error === 'SERVICE_UNAVAILABLE') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Portal is temporarily unavailable. Please try again.',
            },
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
        { status: 401 },
      );
    }

    const { client, sessionToken } = result;
    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: client.id,
          referenceNumber: client.referenceNumber,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          clientId: client.id,
        },
      },
      { status: 200 },
    );

    response.cookies.set(portalSessionCookieOptions(sessionToken));
    return response;
  },
});
