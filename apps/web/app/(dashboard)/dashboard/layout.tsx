import type { Metadata } from 'next';
import { DashboardAuthGuard } from '@/components/auth/dashboard-auth-guard';
import { DashboardDataPrefetch } from '@/components/dashboard/dashboard-data-prefetch';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthGuard>
      <DashboardDataPrefetch />
      <DashboardNav>{children}</DashboardNav>
    </DashboardAuthGuard>
  );
}
