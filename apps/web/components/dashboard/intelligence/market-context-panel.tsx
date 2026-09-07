'use client';

import { ArrowDown, Clock } from 'lucide-react';
import { rateSensitivityLadder } from '@/lib/calculators/formulas';
import type { IntelligenceCurrentRates } from '@/lib/intelligence/types';

type Props = {
  rates: IntelligenceCurrentRates | undefined;
  isLoading?: boolean;
  /** Loan used for ladder payments (defaults to 275k / 30y). */
  principal?: number;
  termYears?: number;
  /** When set (e.g. Monthly Payment calc), badge shows vs entered rate. */
  comparisonRatePct?: number | null;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

export function MarketContextPanel({
  rates,
  isLoading,
  principal = 275_000,
  termYears = 30,
  comparisonRatePct = null,
}: Props) {
  const centre = rates?.fixed2yrPct;
  const delayed = rates?.delayed || centre == null;
  const ladder =
    centre != null ? rateSensitivityLadder(principal, termYears, centre) : null;

  const badgePts =
    centre != null && comparisonRatePct != null
      ? comparisonRatePct - centre
      : centre != null
        ? 0
        : null;

  return (
    <div className="rounded-2xl border border-[#E4E4E4] bg-white p-5">
      <h3 className="font-heading text-[14.5px] font-bold text-ink">Market context</h3>
      <p className="mb-3 text-xs text-[#8b948d]">
        Rate sensitivity on {formatMoney(principal)} over {termYears} years
      </p>

      {isLoading ? (
        <p className="text-sm text-[#8b948d]">Loading market rates…</p>
      ) : delayed || !ladder ? (
        <p className="rounded-xl border border-[#E4E4E4] bg-[#fafafa] px-3 py-4 text-sm text-[#5b665f]">
          Rate data delayed — calculator still works. Waiting for first rate import.
        </p>
      ) : (
        <div>
          {ladder.map((rung) => (
            <div
              key={rung.ratePct}
              className="flex items-center justify-between border-b border-[#E4E4E4] py-2.5 text-[13px] last:border-b-0"
            >
              <span className="inline-flex items-center gap-2">
                <span className="font-numeric">{rung.ratePct.toFixed(2)}%</span>
                {rung.isBenchmark ? (
                  <span className="rounded-full bg-brand-teal-700 px-2 py-0.5 text-[10.5px] font-bold text-white">
                    2yr benchmark
                  </span>
                ) : null}
              </span>
              <span className="font-numeric font-bold">{formatMoney(rung.monthlyPayment)}/mo</span>
            </div>
          ))}

          {badgePts != null ? (
            <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-brand-teal-50 px-3 py-1.5 text-[12.5px] font-bold text-[#04342C]">
              <ArrowDown className="h-3.5 w-3.5 text-brand-teal-700" aria-hidden />
              {badgePts === 0
                ? '0.00pts vs current 2yr fixed benchmark'
                : `${badgePts > 0 ? '+' : ''}${badgePts.toFixed(2)}pts vs current 2yr fixed benchmark`}
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-4 border-t border-[#E4E4E4] pt-3.5 text-[11.5px] leading-relaxed text-[#8b948d]">
        {rates?.asAt ? (
          <>
            Benchmarks: Bank of England quoted household rates, as at {rates.asAt}. Not a product
            rate.
          </>
        ) : (
          <>
            <Clock className="mr-1 inline h-3 w-3" aria-hidden />
            Benchmarks unavailable until rate import completes. Not a product rate.
          </>
        )}
      </p>
    </div>
  );
}
