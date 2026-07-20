import { NextResponse } from 'next/server';
import { createHandler } from '@/lib/api/handler';
import { clearPortalSessionCookieOptions } from '@/lib/api/portal-session';

export const POST = createHandler({
  method: 'POST',
  requireAuth: false,
  handler: async () => {
    const response = NextResponse.json({ success: true }, { status: 200 });

    // === FRONTEND ADDITION: env-aware cookie clear (works on local HTTP) ===
    response.cookies.set(clearPortalSessionCookieOptions());
    // === END FRONTEND ADDITION ===

    return response;
  },
});
