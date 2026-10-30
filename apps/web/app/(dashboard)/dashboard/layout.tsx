import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashboardAuthGuard } from '@/components/auth/dashboard-auth-guard';
import { DashboardDataPrefetch } from '@/components/dashboard/dashboard-data-prefetch';
import { getPageOrgAccess } from '@/lib/billing/page-gate';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Live iframe dashboard only (`page.tsx` → LiveDemoPage).
 * Legacy React section pages + sidebar nav are archived/redirected — never remount here.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getPageOrgAccess();
  if (access && !access.allowed) {
    redirect('/subscribe');
  }

  return (
    <DashboardAuthGuard>
      <DashboardDataPrefetch />
      {children}
    </DashboardAuthGuard>
  );
}
