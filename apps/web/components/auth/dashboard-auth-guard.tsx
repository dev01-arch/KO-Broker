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

  // Keep the shell mounted as soon as Clerk reports signed-in; only block
  // when we still don't know auth state.
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] text-sm text-ink-60">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
          <p>Opening dashboard…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}
