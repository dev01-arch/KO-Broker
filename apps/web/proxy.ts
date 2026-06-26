import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  '',
);

const isPublicRoute = createRouteMatcher([
  '/',
  '/gate(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/demo(.*)',
  // Handlers enforce auth via Bearer token — never redirect /api to sign-in (cross-origin SPA).
  '/api/(.*)',
]);

export default clerkMiddleware(
  async (auth, req) => {
    if (isPublicRoute(req)) return;
    await auth.protect();
  },
  {
    // JWTs are issued on the Vercel frontend; Render must accept that origin as azp.
    authorizedParties: [appOrigin, 'http://localhost:3001'],
  },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
