'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import type { Plan } from '@ko/types';
import { PricingCard } from '@/components/marketing/pricing-card';
import {
  formatPlanLabel,
  PLAN_ORDER,
  PRICING_TIERS,
} from '@/lib/constants/pricing-plans';
import {
  useBillingPortal,
  useBillingSubscription,
  useCreateCheckout,
} from '@/hooks/use-billing';
import { useIsAdmin, useOrgProfile } from '@/hooks/use-org';
import { formatApiError } from '@/lib/api/client';

type BillingSettingsSectionProps = {
  billingNotice?: 'success' | 'cancel' | null;
  onBillingNoticeDismiss?: () => void;
};

function planRank(plan: Plan): number {
  return PLAN_ORDER[plan] ?? 0;
}

function formatBillingDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function BillingSuccessModal({ onContinue }: { onContinue: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onContinue, 4000);
    return () => window.clearTimeout(timer);
  }, [onContinue]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-success-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-xl border border-ink-20 bg-white p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-teal-50">
              <CheckCircle2 className="h-6 w-6 text-brand-teal-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="billing-success-title" className="font-heading text-lg font-bold text-ink">
                Payment successful
              </h2>
              <p className="mt-2 text-sm text-ink-60">
                Your subscription is being activated. You will be redirected to billing settings
                shortly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="mt-6 w-full rounded-lg bg-brand-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-teal-700"
          >
            Continue to billing
          </button>
        </div>
      </div>
    </>
  );
}

export function BillingSettingsSection({
  billingNotice = null,
  onBillingNoticeDismiss,
}: BillingSettingsSectionProps) {
  const isAdmin = useIsAdmin();
  const { data: profile, isLoading } = useOrgProfile();
  const { mutateAsync: checkout, isPending, error } = useCreateCheckout();
  const {
    data: subscription,
    isLoading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useBillingSubscription(!isLoading);
  const {
    mutateAsync: openBillingPortal,
    isPending: portalPending,
    error: portalError,
  } = useBillingPortal();
  const [upgradingPlan, setUpgradingPlan] = useState<'PROFESSIONAL' | 'ENTERPRISE' | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const currentPlan = profile?.plan ?? 'STARTER';
  const hasBillingAccount = Boolean(subscription?.hasBillingAccount);
  const showManageSection =
    subscriptionLoading || hasBillingAccount || currentPlan !== 'STARTER';
  const renewalDate = formatBillingDate(subscription?.currentPeriodEnd);

  useEffect(() => {
    if (billingNotice === 'success') {
      setShowSuccessModal(true);
      void refetchSubscription();
    }
  }, [billingNotice, refetchSubscription]);

  // Advisers never see billing UI.
  if (!isAdmin) {
    return null;
  }

  function handleSuccessModalContinue() {
    setShowSuccessModal(false);
    onBillingNoticeDismiss?.();
  }

  async function handleUpgrade(plan: 'PROFESSIONAL' | 'ENTERPRISE') {
    setUpgradingPlan(plan);
    try {
      const url = await checkout(plan);
      window.location.assign(url);
    } catch {
      setUpgradingPlan(null);
    }
  }

  async function handleOpenBillingPortal() {
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch {
      // Error surfaced via portalError
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-ink-60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading billing…
      </div>
    );
  }

  return (
    <>
      {showSuccessModal && <BillingSuccessModal onContinue={handleSuccessModalContinue} />}

      <div className="space-y-8">
        <div className="rounded-lg border border-ink-20 bg-ink-08/40 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-60">Current plan</p>
          <p className="mt-1 font-heading text-lg font-bold text-ink">{formatPlanLabel(currentPlan)}</p>
          <p className="mt-1 text-sm text-ink-60">
            Per adviser, per month. No setup fees. Cancel any time.
          </p>
          {renewalDate && !subscription?.cancelAtPeriodEnd && (
            <p className="mt-2 text-sm text-ink-60">Next billing date: {renewalDate}</p>
          )}
          {subscription?.cancelAtPeriodEnd && renewalDate && (
            <p className="mt-2 text-sm text-amber-700">
              Cancellation scheduled. Access continues until {renewalDate}.
            </p>
          )}
        </div>

        {billingNotice === 'cancel' && (
          <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-ink-60">
            Checkout was cancelled. No changes were made to your subscription.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
            {formatApiError(error, {
              fallback:
                'Could not start checkout. Add STRIPE_SECRET_KEY (sk_test_...) to apps/web/.env.local and restart the dev server.',
            })}
          </div>
        )}

        {portalError && (
          <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
            {formatApiError(portalError, {
              fallback:
                'Could not open Stripe billing portal. Enable the Customer Portal in your Stripe Dashboard.',
            })}
          </div>
        )}

        {showManageSection && (
          <div className="rounded-lg border border-ink-20 bg-white px-4 py-4">
            <h3 className="font-heading text-base font-bold text-ink">Manage subscription</h3>
            <p className="mt-1 text-sm text-ink-60">
              Update payment details, view invoices, or cancel your subscription in Stripe&apos;s
              secure billing portal.
            </p>
            {!isAdmin && (
              <p className="mt-3 text-sm text-ink-60">
                Only organisation admins can manage billing.
              </p>
            )}
            {subscriptionLoading ? (
              <div className="mt-4 flex items-center text-sm text-ink-60">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading billing account…
              </div>
            ) : subscription?.cancelAtPeriodEnd ? (
              <p className="mt-4 text-sm text-ink-60">
                Your subscription is scheduled to cancel
                {renewalDate ? ` on ${renewalDate}` : ''}. You can review this in Stripe billing
                settings.
              </p>
            ) : null}
            {isAdmin && hasBillingAccount && (
              <button
                type="button"
                onClick={() => void handleOpenBillingPortal()}
                disabled={portalPending}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink-20 bg-white px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink-08 disabled:opacity-50"
              >
                {portalPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {portalPending ? 'Opening Stripe…' : 'Manage billing in Stripe'}
              </button>
            )}
            {isAdmin && !hasBillingAccount && !subscriptionLoading && (
              <p className="mt-4 text-sm text-ink-60">
                Complete a checkout first to create your Stripe billing account. If you already paid,
                add <span className="font-mono">STRIPE_WEBHOOK_SECRET</span> and restart the dev
                server so your plan can sync.
              </p>
            )}
          </div>
        )}

        <div>
          <h3 className="font-heading text-base font-bold text-ink">Available plans</h3>
          <p className="mt-1 text-sm text-ink-60">
            Upgrade to unlock messaging, AI reports, client portal, and enterprise features.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const isCurrent = tier.plan === currentPlan;
            const isIncluded = planRank(currentPlan) > planRank(tier.plan);
            const canUpgrade = Boolean(tier.checkoutPlan) && planRank(tier.plan) > planRank(currentPlan);
            const checkoutPlan = tier.checkoutPlan;
            const isUpgrading = isPending && checkoutPlan != null && upgradingPlan === checkoutPlan;

            let buttonText = 'Included';
            if (isCurrent) buttonText = 'Current plan';
            else if (canUpgrade && checkoutPlan) buttonText = `Upgrade to ${tier.name}`;

            return (
              <PricingCard
                key={tier.id}
                v2Design={tier.v2Design}
                tier={tier.name}
                price={tier.price}
                features={tier.features}
                mostPopular={tier.mostPopular}
                isCurrentPlan={isCurrent}
                buttonDisabled={isIncluded || isCurrent || !canUpgrade || isUpgrading}
                buttonLoading={isUpgrading}
                buttonText={buttonText}
                onButtonClick={
                  canUpgrade && checkoutPlan
                    ? () => void handleUpgrade(checkoutPlan)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
