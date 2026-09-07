'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CaseSummary } from '@/lib/api/client';
import { useIntelligenceOverview } from '@/hooks/use-intelligence';
import { MarketOverview } from './market-overview';
import { CaseIntelligence } from './case-intelligence';
import { IntelligenceCalculator } from './intelligence-calculator';

type IntelTab = 'overview' | 'case' | 'calc';

type Props = {
  cases: CaseSummary[];
  casesLoading?: boolean;
  /** From `?caseId=` — opens Case tab and confirm flow. */
  initialCaseId?: string | null;
  onConsumedCaseId?: () => void;
};

export function MortgageIntelligencePanel({
  cases,
  casesLoading,
  initialCaseId,
  onConsumedCaseId,
}: Props) {
  const [tab, setTab] = useState<IntelTab>(() => (initialCaseId ? 'case' : 'overview'));
  const [caseIdBoot, setCaseIdBoot] = useState<string | null>(initialCaseId ?? null);

  const { data: overview, isLoading: overviewLoading } = useIntelligenceOverview(true);

  useEffect(() => {
    if (initialCaseId) {
      setTab('case');
      setCaseIdBoot(initialCaseId);
    }
  }, [initialCaseId]);

  const clearCaseBoot = useCallback(() => {
    setCaseIdBoot(null);
    onConsumedCaseId?.();
  }, [onConsumedCaseId]);

  return (
    <div className="w-full px-4 pb-10 lg:px-0">
      <h1 className="font-heading text-[28px] font-extrabold tracking-tight text-ink">
        Mortgage Intelligence
      </h1>
      <p className="mb-5 text-sm text-[#5b665f]">
        Free-data market context for every case — no lender products, no recommendations.
      </p>

      <div
        role="tablist"
        aria-label="Mortgage Intelligence sections"
        className="mb-6 flex gap-1.5 border-b border-[#E4E4E4]"
      >
        {(
          [
            { id: 'overview', label: 'Market overview' },
            { id: 'case', label: 'Case intelligence' },
            { id: 'calc', label: 'Calculator' },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`intel-tab-${t.id}`}
              aria-controls={`intel-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`relative -mb-px mr-5 px-1 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-b-2 border-brand-teal-700 text-ink'
                  : 'border-b-2 border-transparent text-[#8b948d] hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="intel-panel-overview"
        aria-labelledby="intel-tab-overview"
        hidden={tab !== 'overview'}
      >
        {tab === 'overview' ? (
          <MarketOverview data={overview} isLoading={overviewLoading} />
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="intel-panel-case"
        aria-labelledby="intel-tab-case"
        hidden={tab !== 'case'}
      >
        {tab === 'case' ? (
          <CaseIntelligence
            cases={cases}
            casesLoading={casesLoading}
            initialCaseId={caseIdBoot}
            onClearInitialCaseId={clearCaseBoot}
          />
        ) : null}
      </div>

      <div
        role="tabpanel"
        id="intel-panel-calc"
        aria-labelledby="intel-tab-calc"
        hidden={tab !== 'calc'}
      >
        {tab === 'calc' ? <IntelligenceCalculator /> : null}
      </div>
    </div>
  );
}
