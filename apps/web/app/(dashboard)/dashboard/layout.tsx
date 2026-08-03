import type { Metadata } from 'next';
import { DashboardAuthGuard } from '@/components/auth/dashboard-auth-guard';
import { DashboardDataPrefetch } from '@/components/dashboard/dashboard-data-prefetch';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Live iframe dashboard only (`page.tsx` → LiveDemoPage).
 * Legacy React section pages + sidebar nav are archived/redirected — never remount here.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthGuard>
      <DashboardDataPrefetch />
      {children}
    </DashboardAuthGuard>
  );
}
