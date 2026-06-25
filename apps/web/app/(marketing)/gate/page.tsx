import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DemoLoginPage } from '@/components/auth/demo-login-page';

export const metadata: Metadata = {
  title: 'Sign in',
};

/** Staging gate — KingOlu / Development credentials. Shown when opening the app. */
export default function GatePage() {
  return (
    <Suspense fallback={null}>
      <DemoLoginPage />
    </Suspense>
  );
}
