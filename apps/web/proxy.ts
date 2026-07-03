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
  // /demo is intentionally excluded — unauthenticated visitors are redirected to sign-in.
  // Handlers enforce auth via Bearer token — never redirect /api to sign-in (cross-origin SPA).
  '/api/(.*)',
]);

export default clerkMiddleware(
  async (auth, req) => {
    const preflight = handleApiCorsPreflight(req);
    if (preflight) return preflight;

    const isApi = req.nextUrl.pathname.startsWith('/api/');

    if (isPublicRoute(req)) {
      return isApi ? applyCorsHeaders(req, NextResponse.next()) : undefined;
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
