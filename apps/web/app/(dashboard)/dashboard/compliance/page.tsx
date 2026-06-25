'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { useCases } from '@/hooks/use-cases';
import { useAdvanceComplianceStage } from '@/hooks/use-compliance';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { formatClientName } from '@/lib/api/client-display';
import { formatApiError, getApiErrorDetails } from '@/lib/api/client';
import type { CaseStage, CaseSummary } from '@/lib/api/client';

const STAGE_ORDER: CaseStage[] = [
  'ENQUIRY',
  'FACT_FIND',
  'RESEARCH',
  'DIP',
  'OFFER',
  'COMPLETION',
  'ARCHIVED',
];

const STAGE_LABELS: Record<CaseStage, string> = {
  ENQUIRY: 'Enquiry',
  FACT_FIND: 'Fact Find',
  RESEARCH: 'Research',
  DIP: 'DIP',
  OFFER: 'Offer',
  COMPLETION: 'Completion',
  ARCHIVED: 'Archived',
};

const STAGE_COLORS: Record<CaseStage, string> = {
  ENQUIRY: 'bg-ink-08 text-ink-60 border-ink-20',
  FACT_FIND: 'bg-blue/10 text-blue border-blue/20',
  RESEARCH: 'bg-purple/10 text-purple border-purple/20',
  DIP: 'bg-amber/10 text-amber border-amber/20',
  OFFER: 'bg-brand-teal-50 text-brand-teal-700 border-brand-teal-200',
  COMPLETION: 'bg-green/10 text-green border-green/20',
  ARCHIVED: 'bg-ink-08 text-ink-60 border-ink-20',
};

const COMPLIANCE_CHECKS: Record<CaseStage, string[]> = {
  ENQUIRY: ['Client identity verified', 'AML check initiated', 'Initial disclosure provided'],
  FACT_FIND: ['Fact find completed', 'Income documents collected', 'Expenditure verified'],
  RESEARCH: ['Product research documented', 'Products considered logged', 'Research rationale recorded'],
  DIP: ['DIP submitted to lender', 'Credit check authorized', 'Client informed of outcome'],
  OFFER: ['Full application submitted', 'Valuation instructed', 'Offer received and reviewed'],
  COMPLETION: ['Solicitors instructed', 'Insurance in place', 'Completion confirmed'],
  ARCHIVED: ['Case file archived', 'Documents retained per FCA requirements'],
};

function nextStage(stage: CaseStage): CaseStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 2) return null;
  return STAGE_ORDER[idx + 1] ?? null;
}

function CaseComplianceCard({ caseItem }: { caseItem: CaseSummary }) {
  const { mutateAsync: advanceStage, isPending } = useAdvanceComplianceStage();
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [advanceDetails, setAdvanceDetails] = useState<string[]>([]);
  const checks = COMPLIANCE_CHECKS[caseItem.stage] ?? [];
  const next = nextStage(caseItem.stage);

  async function handleAdvance() {
    if (!next) return;
    setAdvancing(true);
    setAdvanceError(null);
    setAdvanceDetails([]);
    try {
      await advanceStage({ caseId: caseItem.id, targetStage: next });
    } catch (err) {
      setAdvanceError(formatApiError(err, { fallback: 'Could not advance stage.' }));
      setAdvanceDetails(getApiErrorDetails(err) ?? []);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-20 bg-white p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <Link
            href={`/dashboard/clients/${caseItem.clientId}`}
            className="font-heading text-sm font-bold text-ink hover:text-brand-teal-700"
          >
            {formatClientName(caseItem.client)}
          </Link>
          <p className="text-xs text-ink-60 font-mono mt-0.5">{caseItem.referenceNumber}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[caseItem.stage]}`}
        >
          {STAGE_LABELS[caseItem.stage]}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        {checks.map((check) => (
          <div key={check} className="flex items-center gap-2 text-sm text-ink-60">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-teal-500" />
            <span>{check}</span>
          </div>
        ))}
      </div>

      {next && (
        <div className="space-y-2">
          {advanceError && (
            <div className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red space-y-1">
              <p>{advanceError}</p>
              {advanceDetails.length > 0 && (
                <ul className="list-disc pl-4">
                  {advanceDetails.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
          type="button"
          disabled={isPending || advancing}
          onClick={handleAdvance}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-brand-teal-300 bg-brand-teal-50 px-4 py-2 text-sm font-medium text-brand-teal-700 hover:bg-brand-teal-100 disabled:opacity-50 transition-colors"
        >
          {isPending || advancing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Advance to {STAGE_LABELS[next]}
          </button>
        </div>
      )}

      {!next && caseItem.stage === 'COMPLETION' && (
        <div className="flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Case completed — all compliance checks done.
        </div>
      )}
    </div>
  );
}

function StageColumn({ stage, cases }: { stage: CaseStage; cases: CaseSummary[] }) {
  return (
    <div className="min-w-[260px] max-w-[280px]">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-ink-60">
          {STAGE_LABELS[stage]}
        </h2>
        <span className="rounded-full bg-ink-08 px-1.5 py-0.5 text-[10px] font-medium text-ink-60">
          {cases.length}
        </span>
      </div>
      <div className="space-y-3">
        {cases.map((c) => (
          <CaseComplianceCard key={c.id} caseItem={c} />
        ))}
        {cases.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink-20 p-4 text-center text-xs text-ink-60">
            No cases
          </div>
        )}
      </div>
    </div>
  );
}

const LIST_QUERY = { page: 1, perPage: 100 } as const;
const ACTIVE_STAGES: CaseStage[] = ['ENQUIRY', 'FACT_FIND', 'RESEARCH', 'DIP', 'OFFER', 'COMPLETION'];

export default function CompliancePage() {
  const { data, isLoading, isError, error, refetch } = useCases(LIST_QUERY);

  const cases = data?.data ?? [];
  const activeCases = cases.filter((c) => ACTIVE_STAGES.includes(c.stage));
  const byStage = ACTIVE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = activeCases.filter((c) => c.stage === stage);
      return acc;
    },
    {} as Record<CaseStage, CaseSummary[]>,
  );

  return (
    <>
      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand-teal-500" />
          <h1 className="font-heading text-[15px] font-bold text-ink">Compliance Engine</h1>
          {!isLoading && (
            <span className="rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
              {activeCases.length} active cases
            </span>
          )}
        </div>
      </div>

      <div className="p-7">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-ink-60">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading cases…</span>
          </div>
        ) : isError ? (
          <ApiErrorState
            error={error}
            fallback="Failed to load compliance data."
            onRetry={() => void refetch()}
          />
        ) : activeCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ShieldCheck className="h-12 w-12 text-ink-20" />
            <p className="text-sm font-medium text-ink-60">No active cases to review.</p>
            <Link
              href="/dashboard/clients"
              className="text-sm text-brand-teal-600 hover:underline"
            >
              Go to Clients →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-5 min-w-max">
              {ACTIVE_STAGES.map((stage) => (
                <StageColumn key={stage} stage={stage} cases={byStage[stage] ?? []} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
