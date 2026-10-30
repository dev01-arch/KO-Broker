'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignOutButton, useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import type { Plan } from '@ko/types';
import { PricingCard } from '@/components/marketing/pricing-card';
import { PRICING_TIERS, yearlyPrice } from '@/lib/constants/pricing-plans';
import { useBillingPortal, useCreateCheckout } from '@/hooks/use-billing';
import { useIsAdmin, useOrgProfile } from '@/hooks/use-org';
import {
  billingApi,
  formatApiError,
  requireAuthToken,
  type BillingInterval,
  type OrgAccessReason,
} from '@/lib/api/client';

const SYNC_ATTEMPTS = 10;
const SYNC_DELAY_MS = 2000;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function headline(reason: OrgAccessReason, trialEndsAt: string | null) {
  const ended = formatDate(trialEndsAt);
  switch (reason) {
    case 'payment_failed':
      return {
        title: 'Your last payment did not go through',
        body: 'Update your payment method to restore access, or choose a plan below.',
      };
    case 'canceled':
      return {
        title: 'Your subscription has ended',
        body: 'Choose a plan to restore access to your dashboard. Your data is kept safe.',
      };
    default:
      return {
        title: 'Your free trial has ended',
        body: `${ended ? `Your 30-day trial ended on ${ended}. ` : ''}Choose a plan to keep using KO Platform. Your data is kept safe.`,
      };
  }
}

export function SubscribePanel({
  reason,
  trialEndsAt,
}: {
  reason: OrgAccessReason;
  trialEndsAt: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const checkoutState = searchParams.get('checkout');
  const { getToken } = useAuth();
  const { isLoading: profileLoading } = useOrgProfile();
  const isAdmin = useIsAdmin();
  const [interval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirming, setConfirming] = useState(checkoutState === 'success');
  const [confirmFailed, setConfirmFailed] = useState(false);
  const { mutateAsync: checkout, isPending, error } = useCreateCheckout();
  const { mutateAsync: openPortal, isPending: portalPending, error: portalError } = useBillingPortal();

  useEffect(() => {
    if (checkoutState !== 'success') return;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < SYNC_ATTEMPTS && !cancelled; attempt += 1) {
        try {
          const token = await requireAuthToken(getToken);
          const { data } = await billingApi.syncAccess(token);
          if (data.allowed) {
            router.replace('/dashboard');
            return;
          }
        } catch {
          // Retry until the attempts run out.
        }
        await new Promise((resolve) => setTimeout(resolve, SYNC_DELAY_MS));
      }
      if (!cancelled) {
        setConfirming(false);
        setConfirmFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkoutState, getToken, router]);

  async function handleChoose(plan: Plan) {
    setSelectedPlan(plan);
    const origin = window.location.origin;
    try {
      const url = await checkout({
        plan,
        interval,
        successUrl: `${origin}/subscribe?checkout=success`,
        cancelUrl: `${origin}/subscribe?checkout=cancel`,
      });
      window.location.assign(url);
    } catch {
      setSelectedPlan(null);
    }
  }

  async function handleUpdatePayment() {
    try {
      window.location.assign(await openPortal());
    } catch {
      // Shown via portalError
    }
  }

  const copy = headline(reason, trialEndsAt);

  if (confirming) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-teal-600" />
          <h1 className="font-heading text-xl font-bold text-ink">Confirming your payment…</h1>
          <p className="text-sm text-ink-60">This usually takes a few seconds.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-bold text-ink">{copy.title}</h1>
          <p className="max-w-2xl text-sm text-ink-60">{copy.body}</p>
        </header>

        {confirmFailed && (
          <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-ink-60">
            We could not confirm your payment yet. If you completed checkout, refresh this page in a
            minute. Contact support if access is not restored.
          </div>
        )}
        {checkoutState === 'cancel' && (
          <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-ink-60">
            Checkout was cancelled. You have not been charged.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
            {formatApiError(error, { fallback: 'Could not start checkout. Please try again.' })}
          </div>
        )}
        {portalError && (
          <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
            {formatApiError(portalError, { fallback: 'Could not open the billing portal.' })}
          </div>
        )}

        {profileLoading ? (
          <div className="flex items-center text-sm text-ink-60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : !isAdmin ? (
          <div className="rounded-lg border border-ink-20 bg-white px-4 py-4 text-sm text-ink-60">
            Only your organisation admin can choose a plan. Please ask them to subscribe, then
            refresh this page.
          </div>
        ) : (
          <>
            {reason === 'payment_failed' && (
              <div>
                <button
                  type="button"
                  onClick={() => void handleUpdatePayment()}
                  disabled={portalPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:opacity-50"
                >
                  {portalPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update payment method
                </button>
              </div>
            )}

            <div
              role="radiogroup"
              aria-label="Billing period"
              className="inline-flex w-fit rounded-full border border-ink-20 bg-white p-1 text-sm"
            >
              {(['monthly', 'yearly'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={interval === option}
                  onClick={() => setBillingInterval(option)}
                  className={`rounded-full px-4 py-1.5 font-medium ${
                    interval === option ? 'bg-brand-teal-500 text-white' : 'text-ink-60'
                  }`}
                >
                  {option === 'monthly' ? 'Monthly' : 'Yearly (2 months free)'}
                </button>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              {PRICING_TIERS.map((tier) => {
                const plan = tier.checkoutPlan ?? tier.plan;
                const loading = isPending && selectedPlan === plan;
                return (
                  <PricingCard
                    key={tier.id}
                    v2Design={tier.v2Design}
                    tier={tier.name}
                    price={interval === 'yearly' ? yearlyPrice(tier) : tier.price}
                    pricePeriod={interval === 'yearly' ? '/adviser/yr' : '/adviser/mo'}
                    features={tier.features}
                    mostPopular={tier.mostPopular}
                    buttonText={`Choose ${tier.name}`}
                    buttonLoading={loading}
                    buttonDisabled={isPending}
                    onButtonClick={() => void handleChoose(plan)}
                  />
                );
              })}
            </div>
          </>
        )}

        <div>
          <SignOutButton redirectUrl="/sign-in">
            <button type="button" className="text-sm font-medium text-ink-60 underline hover:text-ink">
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </main>
  );
}
