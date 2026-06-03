'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/demo-session';

const PUBLIC_PATHS = new Set(['/sign-in', '/sign-up']);

type SiteAuthGuardProps = {
  children: React.ReactNode;
  /** Where to send unauthenticated users (default: sign-in with return URL). */
  loginPath?: string;
};

export function SiteAuthGuard({ children, loginPath = '/sign-in' }: SiteAuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      const redirect = encodeURIComponent(pathname);
      router.replace(`${loginPath}?redirect=${redirect}`);
      return;
    }
    setReady(true);
  }, [pathname, router, loginPath]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg text-sm text-gray-500">
        Checking session…
      </div>
    );
  }

  return <>{children}</>;
}

type MarketingAuthLayoutProps = {
  children: React.ReactNode;
};

/** Gates all marketing routes except sign-in / sign-up (matches ko-platform prototype). */
export function MarketingAuthLayout({ children }: MarketingAuthLayoutProps) {
  const pathname = usePathname();

  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return <SiteAuthGuard>{children}</SiteAuthGuard>;
}
