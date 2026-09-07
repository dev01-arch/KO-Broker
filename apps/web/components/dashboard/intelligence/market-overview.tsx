'use client';

import { BarChart3, Clock, PoundSterling, TrendingDown, TrendingUp } from 'lucide-react';
import type { IntelligenceOverview, MarketSignal } from '@/lib/intelligence/types';
import { ComplianceBar } from './compliance-bar';

type Props = {
  data: IntelligenceOverview | undefined;
  isLoading?: boolean;
};

function formatPct(value: number | null) {
  if (value == null) return '—';
  return `${value.toFixed(2)}%`;
}

function signalLabel(signal: MarketSignal | null) {
  if (!signal) return null;
  if (signal === 'IMPROVING') return 'IMPROVING';
  if (signal === 'WORSENING') return 'WORSENING';
  return 'STABLE';
}

function cardIcon(id: string) {
  if (id === 'effective_new') return <PoundSterling className="h-4 w-4 stroke-[#5b665f]" />;
  if (id.includes('ltv')) return <BarChart3 className="h-4 w-4 stroke-[#5b665f]" />;
  return <TrendingUp className="h-4 w-4 stroke-[#5b665f]" />;
}

/** Same gradient set as dashboard Overview KPI cards (`ov-kpi-card`). */
const RATE_CARD_STYLES = [
  {
    background: 'linear-gradient(207deg, #DBFAFF -9.75%, #FFF 38.67%)',
    border: '#AEC9CE',
    shadow: '0 3.758px 6.764px 0 rgba(190,200,202,0.19)',
  },
  {
    background: 'linear-gradient(207deg, #E9ECFF -9.75%, #FFF 38.67%)',
    border: '#A19BBF',
    shadow: '0 6.421px 11.558px 0 #F0F2FF',
  },
  {
    background: 'linear-gradient(207deg, #D5FBEE -9.75%, #FFF 38.67%)',
    border: '#AECEC0',
    shadow: '0 3.758px 6.764px 0 rgba(190,200,202,0.19)',
  },
  {
    background: 'linear-gradient(207deg, #F9C5DC -9.75%, #FFF 38.67%)',
    border: '#CEAEC8',
    shadow: '0 3.758px 6.764px 0 rgba(190,200,202,0.19)',
  },
] as const;

export function MarketOverview({ data, isLoading }: Props) {
  if (isLoading && !data) {
    return (
      <div className="rounded-2xl border border-[#E4E4E4] bg-white p-8 text-sm text-[#8b948d]">
        Loading market overview…
      </div>
    );
  }

  const waiting = data?.waitingForImport ?? true;
  const rates = data?.rates ?? [];

  return (
    <div>
      {data?.ratesStale ? (
        <p className="mb-4 rounded-xl border border-[#f0dfae] bg-[#fff8ea] px-4 py-2.5 text-[13px] text-[#7a5b12]">
          Rate data is older than usual — figures below are still shown.
        </p>
      ) : null}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rates.map((card, index) => {
          const good =
            card.change12mPts != null ? card.change12mPts < 0 : card.tone === 'good';
          const bad = card.tone === 'bad' || (card.change12mPts != null && card.change12mPts > 0);
          const style = RATE_CARD_STYLES[index % RATE_CARD_STYLES.length];
          return (
            <div
              key={card.id}
              className="rounded-[15px] border p-5"
              style={{
                background: style.background,
                borderColor: style.border,
                boxShadow: style.shadow,
              }}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13.5px] font-bold text-ink">{card.label}</p>
                  <p className="mt-0.5 text-xs text-[#8b948d]">{card.subtitle}</p>
                </div>
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#f4f5f2]">
                  {cardIcon(card.id)}
                </div>
              </div>
              <p className="font-numeric mb-1.5 text-[27px] font-extrabold tracking-tight text-ink">
                {formatPct(card.valuePct)}
              </p>
              {waiting && card.valuePct == null ? (
                <p className="text-[12.5px] font-semibold text-[#8b948d]">
                  Waiting for first rate import
                </p>
              ) : card.changeLabel ? (
                <p
                  className={`flex items-center gap-1 text-[12.5px] font-semibold ${
                    good ? 'text-brand-teal-700' : bad ? 'text-[#c23b3b]' : 'text-[#5b665f]'
                  }`}
                >
                  {good ? (
                    <TrendingDown className="h-3 w-3" aria-hidden />
                  ) : bad ? (
                    <TrendingUp className="h-3 w-3" aria-hidden />
                  ) : null}
                  {card.changeLabel}
                </p>
              ) : (
                <p className="text-[12.5px] text-[#8b948d]">—</p>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#8b948d]">
                <Clock className="h-2.5 w-2.5" aria-hidden />
                {card.asAt ? `as at ${card.asAt}` : 'as at —'}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-5 rounded-[18px] bg-brand-teal-700 px-6 py-6 text-white">
        {data?.signal ? (
          <>
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-bold tracking-wide">
              <TrendingUp className="h-3.5 w-3.5 stroke-[#bfe9d8]" aria-hidden />
              MARKET SIGNAL — {signalLabel(data.signal)}
            </div>
            <p className="max-w-xl text-[15px] font-medium leading-relaxed text-[#eaf7f1]">
              {data.signalSummary}
            </p>
            {data.signalMeta ? (
              <p className="mt-2.5 text-xs text-[#9fd6c1]">{data.signalMeta}</p>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-bold tracking-wide">
              MARKET SIGNAL — WAITING
            </div>
            <p className="max-w-xl text-[15px] font-medium leading-relaxed text-[#eaf7f1]">
              Market signal will appear after the first Bank of England rate import.
            </p>
          </>
        )}
      </div>

      <section>
        <h3 className="mb-3 text-[15px] font-bold text-ink">Data sources</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {(data?.feeds ?? []).map((feed) => (
            <div key={feed.feedId} className="rounded-[18px] border border-[#E4E4E4] bg-white p-5">
              <div className="flex justify-between gap-3 border-b border-dashed border-[#E4E4E4] py-2 text-[13px]">
                <span className="text-[#5b665f]">{feed.label}</span>
                <span className="font-semibold text-ink">{feed.cadence}</span>
              </div>
              <div className="flex justify-between gap-3 py-2 text-[13px]">
                <span className="text-[#5b665f]">Last retrieved</span>
                <span className="font-bold text-ink">{feed.lastRetrievedLabel ?? '—'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ComplianceBar />
    </div>
  );
}
