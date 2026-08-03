'use client';

import { SignIn, SignUp } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';

const clerkAppearance = {
  variables: {
    colorPrimary: '#1D9E75',
    colorBackground: '#ffffff',
    colorText: '#0D1F1A',
    colorTextSecondary: 'rgba(13,31,26,0.6)',
    borderRadius: '10px',
    fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
  },
  elements: {
    card: 'shadow-none border border-ink-20 rounded-xl',
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',
  },
};

const DEFAULT_REDIRECT = '/dashboard';

type ClerkAuthPageProps = {
  mode: 'sign-in' | 'sign-up';
  title: string;
  subtitle: string;
};

/**
 * Hash routing avoids optional catch-all URL segments (`/sign-in/[[...slug]]`),
 * which were resolving as 404 under Next.js 16 + Turbopack in this app.
 */
export function ClerkAuthPage({ mode, title, subtitle }: ClerkAuthPageProps) {
  const searchParams = useSearchParams();
  const redirectUrl =
    searchParams.get('redirect_url') ||
    searchParams.get('redirect') ||
    DEFAULT_REDIRECT;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal-500 shadow-lg">
          <Building2 className="h-7 w-7 text-white" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-60">{subtitle}</p>
      </div>

      {mode === 'sign-in' ? (
        <SignIn
          routing="hash"
          signUpUrl="/sign-up"
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
          appearance={clerkAppearance}
        />
      ) : (
        <SignUp
          routing="hash"
          signInUrl="/sign-in"
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
          appearance={clerkAppearance}
        />
      )}
    </div>
  );
}
