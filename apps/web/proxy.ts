import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { applyCorsHeaders, handleApiCorsPreflight } from '@/lib/api/cors';

const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
);

const isPublicRoute = createRouteMatcher([
  '/',
  '/gate(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/portal(.*)',
  // Adviser invite landing — page handles sign-in/up then accept-invite.
  '/adviser/invite(.*)',
  // Handlers enforce auth — never redirect /api to sign-in (cross-origin SPA).
  '/api/(.*)',
]);

export default clerkMiddleware(
  async (auth, req) => {
    const preflight = handleApiCorsPreflight(req);
    if (preflight) return preflight;

    const isApi = req.nextUrl.pathname.startsWith('/api/');

    if (isPublicRoute(req)) {
      // === FRONTEND ADDITION: inject Clerk identity headers for createHandler auth ===
      // Same pattern as backend proxy.ts — API routes read x-user-id / x-org-id.
      if (isApi) {
        const authObj = await auth();
        const requestHeaders = new Headers(req.headers);
        requestHeaders.delete('x-user-id');
        requestHeaders.delete('x-org-id');
        requestHeaders.delete('x-user-role');

        if (authObj.userId) {
          requestHeaders.set('x-user-id', authObj.userId);
        }
        if (authObj.orgId) {
          requestHeaders.set('x-org-id', authObj.orgId);
        }
        if (authObj.orgRole) {
          const lowerRole = authObj.orgRole.toLowerCase();
          let role = 'ADVISER';
          if (lowerRole === 'org:admin' || lowerRole.includes('admin')) {
            role = 'ADMIN';
          } else if (lowerRole === 'org:compliance' || lowerRole.includes('compliance')) {
            role = 'COMPLIANCE';
          } else if (lowerRole === 'org:viewer' || lowerRole.includes('viewer')) {
            role = 'VIEWER';
          }
          requestHeaders.set('x-user-role', role);
        }

        return applyCorsHeaders(
          req,
          NextResponse.next({
            request: { headers: requestHeaders },
          }),
        );
      }
      // === END FRONTEND ADDITION ===
      return undefined;
    }

    await auth.protect();
    return isApi ? applyCorsHeaders(req, NextResponse.next()) : undefined;
  },
  {
    authorizedParties: [appOrigin, 'http://localhost:3001'],
  },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
