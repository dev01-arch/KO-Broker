'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/demo-session';

type SiteAuthGuardProps = {
  children: React.ReactNode;
  loginPath?: string;
};

/** Demo staging gate — KingOlu / Development credentials. */
export function SiteAuthGuard({ children, loginPath = '/gate' }: SiteAuthGuardProps) {
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

/** Routes that skip the demo gate (Clerk sign-in/up from nav). */
const PUBLIC_PATHS = new Set(['/sign-in', '/sign-up', '/gate']);

export function MarketingAuthLayout({ children }: MarketingAuthLayoutProps) {
  const pathname = usePathname();

  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return <SiteAuthGuard>{children}</SiteAuthGuard>;
}
