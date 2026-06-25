import { Suspense } from 'react';
import { LiveDemoPage } from '@/components/marketing/live-demo-page';

/** Approved dashboard — live demo prototype with Clerk-backed API data. */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <LiveDemoPage homeHref="/dashboard" />
    </Suspense>
  );
}
