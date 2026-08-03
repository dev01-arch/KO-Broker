import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClerkAuthPage } from '@/components/auth/clerk-auth-page';

export const metadata: Metadata = {
  title: 'Start free trial',
};

/** Clerk registration page. */
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <ClerkAuthPage
        mode="sign-up"
        title="Start free trial"
        subtitle="Create your KO Platform account"
      />
    </Suspense>
  );
}
