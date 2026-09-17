'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { appAuthorizedOrigins, toSameOriginPath } from '@/lib/auth/app-origins';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /** Prefer cached data — mutations patch caches for instant UI. */
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      allowedRedirectOrigins={appAuthorizedOrigins()}
      signInFallbackRedirectUrl={toSameOriginPath(
        process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
        '/dashboard',
      )}
      signUpFallbackRedirectUrl={toSameOriginPath(
        process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
        '/dashboard',
      )}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ClerkProvider>
  );
}
