'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignIn, SignUp, useAuth } from '@clerk/nextjs';
import { Building2, Loader2 } from 'lucide-react';

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

type Status = 'idle' | 'accepting' | 'success' | 'error';

export function AdviserInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const { isLoaded, isSignedIn } = useAuth();
  const [authMode, setAuthMode] = useState<'sign-up' | 'sign-in'>('sign-up');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const acceptedRef = useRef(false);

  const returnUrl = token
    ? `/adviser/invite?token=${encodeURIComponent(token)}`
    : '/adviser/invite';

  const acceptInvite = useCallback(async () => {
    if (!token || acceptedRef.current) return;
    acceptedRef.current = true;
    setStatus('accepting');
    setError(null);

    try {
      const res = await fetch('/api/advisers/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success) {
        setStatus('error');
        setError(json?.error?.message ?? 'Failed to accept invite. Please try again.');
        acceptedRef.current = false;
        return;
      }

      setStatus('success');
      setTimeout(() => router.replace('/dashboard'), 1200);
    } catch {
      setStatus('error');
      setError('Failed to accept invite. Please try again.');
      acceptedRef.current = false;
    }
  }, [token, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !token) return;
    void acceptInvite();
  }, [isLoaded, isSignedIn, token, acceptInvite]);

  if (!token) {
    return (
      <InviteShell
        title="Invalid invitation"
        subtitle="This invite link is missing a token. Ask your admin to resend the invite."
      />
    );
  }

  if (!isLoaded) {
    return (
      <InviteShell title="Accepting invitation" subtitle="Loading…">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-teal-600" />
      </InviteShell>
    );
  }

  if (isSignedIn) {
    return (
      <InviteShell
        title={status === 'success' ? 'Welcome aboard' : 'Accepting invitation'}
        subtitle={
          status === 'success'
            ? 'Redirecting you to the dashboard…'
            : status === 'error'
              ? error ?? 'Something went wrong.'
              : 'Linking your account to the organisation…'
        }
      >
        {(status === 'accepting' || status === 'idle') && (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-teal-600" />
        )}
        {status === 'error' && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-red">{error}</p>
            <button
              type="button"
              onClick={() => {
                acceptedRef.current = false;
                void acceptInvite();
              }}
              className="rounded-lg bg-brand-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-teal-600"
            >
              Try again
            </button>
          </div>
        )}
      </InviteShell>
    );
  }

  return (
    <InviteShell
      title="Join your organisation"
      subtitle="Create an account or sign in to accept your adviser invitation."
    >
      <div className="mb-4 flex justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setAuthMode('sign-up')}
          className={`rounded-md px-3 py-1.5 font-medium ${
            authMode === 'sign-up' ? 'bg-brand-teal-500 text-white' : 'text-ink-60 hover:bg-ink-08'
          }`}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => setAuthMode('sign-in')}
          className={`rounded-md px-3 py-1.5 font-medium ${
            authMode === 'sign-in' ? 'bg-brand-teal-500 text-white' : 'text-ink-60 hover:bg-ink-08'
          }`}
        >
          Sign in
        </button>
      </div>

      {authMode === 'sign-up' ? (
        <SignUp
          routing="hash"
          forceRedirectUrl={returnUrl}
          fallbackRedirectUrl={returnUrl}
          appearance={clerkAppearance}
        />
      ) : (
        <SignIn
          routing="hash"
          forceRedirectUrl={returnUrl}
          fallbackRedirectUrl={returnUrl}
          appearance={clerkAppearance}
        />
      )}

      <p className="mt-4 text-center text-xs text-ink-60">
        Prefer the full sign-in page?{' '}
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`}
          className="text-brand-teal-700 hover:underline"
        >
          Open sign in
        </Link>
      </p>
    </InviteShell>
  );
}

function InviteShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal-500 shadow-lg">
          <Building2 className="h-7 w-7 text-white" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-1 max-w-md text-sm text-ink-60">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
