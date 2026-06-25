import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/gate(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/demo(.*)',
  '/api/health',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  // API routes return JSON 401/403 from handlers — never redirect to sign-in.
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
