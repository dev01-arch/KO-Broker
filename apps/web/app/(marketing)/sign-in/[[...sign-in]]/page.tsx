import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ClerkAuthPage } from '@/components/auth/clerk-auth-page';

export const metadata: Metadata = {
  title: 'Sign in',
};

/** Clerk authentication — catch-all route required by @clerk/nextjs. */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <ClerkAuthPage
        mode="sign-in"
        title="Sign in"
        subtitle="Sign in to your broker dashboard"
      />
    </Suspense>
  );
}
