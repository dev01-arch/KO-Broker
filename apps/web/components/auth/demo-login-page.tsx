'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Eye, EyeOff, Lock, User } from 'lucide-react';
import { validateLogin, isAuthConfigured } from '@/lib/auth/demo-credentials';
import { isAuthenticated, setAuthenticated } from '@/lib/auth/demo-session';

type DemoLoginPageProps = {
  title?: string;
  subtitle?: string;
};

export function DemoLoginPage({
  title = 'KO Platform',
  subtitle = 'Sign in to continue to the platform.',
}: DemoLoginPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(redirectTo);
    }
  }, [router, redirectTo]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isAuthConfigured()) {
      setError(
        'Login is not configured. Add NEXT_PUBLIC_AUTH_* variables to .env.local and restart the dev server.',
      );
      return;
    }
    setSubmitting(true);
    try {
      if (validateLogin(username, password)) {
        setAuthenticated(username.trim());
        router.push(redirectTo);
        router.refresh();
      } else {
        setError('Invalid username or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-bg via-white to-brand-accent/40 px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-gray-200/80 bg-white p-8 shadow-xl shadow-brand-teal/5 md:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 rounded-xl bg-brand-teal p-3 shadow-lg shadow-brand-teal/20">
            <Building2 className="h-8 w-8 text-white" aria-hidden />
          </div>
          <h1 className="heading-bold text-3xl text-[#061F18]">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <label
              htmlFor="login-username"
              className="text-xs font-semibold tracking-wide text-gray-500 uppercase"
            >
              Authorisation
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-3 pr-3 pl-10 text-sm transition outline-none ring-brand-teal/30 focus:border-brand-teal focus:bg-white focus:ring-2"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="login-password"
              className="text-xs font-semibold tracking-wide text-gray-500 uppercase"
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-3 pr-11 pl-10 text-sm transition outline-none ring-brand-teal/30 focus:border-brand-teal focus:bg-white focus:ring-2"
                aria-invalid={error ? true : undefined}
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p
              id="login-error"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            className="w-full rounded-xl bg-brand-teal py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-teal/20 transition hover:bg-brand-teal-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
