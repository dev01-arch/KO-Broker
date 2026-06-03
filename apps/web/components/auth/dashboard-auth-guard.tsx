'use client';

import { SiteAuthGuard } from '@/components/auth/site-auth-guard';

export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  return <SiteAuthGuard>{children}</SiteAuthGuard>;
}
