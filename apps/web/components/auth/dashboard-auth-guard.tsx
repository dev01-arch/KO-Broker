'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Dashboard access requires a Clerk session.
 * Unauthenticated users are sent to /sign-in (not the staging /gate).
 */
export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      const redirect = encodeURIComponent(pathname);
      router.replace(`/sign-in?redirect_url=${redirect}`);
    }
  }, [isLoaded, isSignedIn, pathname, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-ink-60">
        Loading…
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}
