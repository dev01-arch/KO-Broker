'use client';

import { Lock, Sparkles } from 'lucide-react';
import { useCreateCheckout } from '@/hooks/use-billing';
import { useIsAdmin } from '@/hooks/use-org';
import { formatApiError } from '@/lib/api/client';

type PlanGateProps = {
  feature: string;
  title: string;
  description: string;
  requiredPlan?: 'PROFESSIONAL' | 'ENTERPRISE';
};

export function PlanGate({
  title,
  description,
  requiredPlan = 'PROFESSIONAL',
}: PlanGateProps) {
  const isAdmin = useIsAdmin();
  const { mutateAsync: checkout, isPending, error } = useCreateCheckout();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal-50">
        <Lock className="h-7 w-7 text-brand-teal-600" />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
        <p className="text-sm text-ink-60">{description}</p>
        {!isAdmin && (
          <p className="text-sm text-ink-60">
            Ask your organisation admin if you need this feature upgraded.
          </p>
        )}
      </div>
      {isAdmin ? (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={async () => {
              try {
                const url = await checkout(requiredPlan);
                window.location.href = url;
              } catch {
                // error surfaced below
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-teal-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-teal-600 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isPending ? 'Redirecting…' : `Upgrade to ${requiredPlan}`}
          </button>
          {error && (
            <p className="max-w-sm text-xs text-red">
              {formatApiError(error, { fallback: 'Could not start checkout.' })}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
