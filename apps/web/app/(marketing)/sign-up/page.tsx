import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginPage } from '@/components/auth/login-page';

export const metadata: Metadata = {
  title: 'Start free trial',
};

/** Trial sign-up uses the same demo gate as sign-in until Clerk is wired (PRD-04). */
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <LoginPage
        title="Start free trial"
        subtitle="Sign in with your demo credentials to access the platform."
      />
    </Suspense>
  );
}
