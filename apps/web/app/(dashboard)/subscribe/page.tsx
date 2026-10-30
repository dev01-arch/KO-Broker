import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SubscribePanel } from '@/components/billing/subscribe-panel';
import { getPageOrgAccess } from '@/lib/billing/page-gate';

export const metadata: Metadata = {
  title: 'Choose a plan',
};

/** Paywall: shown when the organisation's trial has ended or its subscription is not active. */
export default async function SubscribePage() {
  const access = await getPageOrgAccess();
  if (!access || access.allowed) {
    redirect('/dashboard');
  }

  return (
    <Suspense fallback={null}>
      <SubscribePanel reason={access.reason} trialEndsAt={access.trialEndsAt} />
    </Suspense>
  );
}
