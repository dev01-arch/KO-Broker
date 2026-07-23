'use client';

import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import {
  formatApiError,
  getApiErrorCode,
  getApiErrorDetails,
  isApiErrorCode,
  API_ERROR_CODES,
} from '@/lib/api/errors';
import { useCreateCheckout } from '@/hooks/use-billing';
import { useIsAdmin } from '@/hooks/use-org';

type ApiErrorStateProps = {
  error: unknown;
  fallback?: string;
  onRetry?: () => void;
  className?: string;
};

export function ApiErrorState({
  error,
  fallback = 'Failed to load data. Please try again.',
  onRetry,
  className = 'py-20',
}: ApiErrorStateProps) {
  const message = formatApiError(error, { fallback });
  const code = getApiErrorCode(error);
  const details = getApiErrorDetails(error);
  const showRetry = onRetry && !isApiErrorCode(error, API_ERROR_CODES.UNAUTHORIZED);
  const isPlanLimit = isApiErrorCode(error, API_ERROR_CODES.PLAN_LIMIT_EXCEEDED);
  const isAdmin = useIsAdmin();
  const { mutateAsync: checkout, isPending: checkoutPending } = useCreateCheckout();

  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-ink-60 ${className}`}>
      <AlertTriangle className="h-6 w-6 text-amber" aria-hidden />
      <p className="max-w-md text-center text-sm">{message}</p>
      {details && details.length > 0 && (
        <ul className="max-w-md list-disc space-y-1 pl-5 text-left text-xs text-ink-60">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {code && (
        <p className="font-mono text-xs text-ink-60/80">{code}</p>
      )}
      {isPlanLimit && isAdmin && (
        <button
          type="button"
          disabled={checkoutPending}
          onClick={async () => {
            const url = await checkout('PROFESSIONAL');
            window.location.href = url;
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-teal-600 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {checkoutPending ? 'Redirecting…' : 'Upgrade plan'}
        </button>
      )}
      {isPlanLimit && !isAdmin && (
        <p className="mt-2 max-w-md text-center text-xs text-ink-60">
          Ask your organisation admin if you need a plan upgrade.
        </p>
      )}
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-teal-700 hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}
