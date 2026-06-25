'use client';

import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCases } from '@/hooks/use-cases';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { formatClientName } from '@/lib/api/client-display';

const CASES_LIST_QUERY = { page: 1, perPage: 100 } as const;
import type { CaseStage, CaseType } from '@/lib/api/client';

const STAGE_LABELS: Record<CaseStage, string> = {
  ENQUIRY: 'Enquiry',
  FACT_FIND: 'Fact find',
  RESEARCH: 'Research',
  DIP: 'DIP',
  OFFER: 'Offer',
  COMPLETION: 'Completion',
  ARCHIVED: 'Archived',
};

const TYPE_LABELS: Record<CaseType, string> = {
  PURCHASE: 'Purchase',
  REMORTGAGE: 'Remortgage',
  BTL: 'Buy to let',
  FURTHER_ADVANCE: 'Further advance',
  PRODUCT_TRANSFER: 'Product transfer',
};

function formatMoney(amount?: number) {
  if (amount == null) return '—';
  return `£${amount.toLocaleString('en-GB')}`;
}

export default function CasesPage() {
  const { data, isLoading, isError, error, refetch } = useCases(CASES_LIST_QUERY);

  const cases = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[15px] font-bold text-ink">Cases</h1>
          {meta && (
            <span className="rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
              {meta.total}
            </span>
          )}
        </div>
        <button
          type="button"
          disabled
          className="rounded-md bg-brand-teal-500 px-4 py-1.5 text-sm font-medium text-white opacity-60 cursor-not-allowed"
        >
          + New Case
        </button>
      </div>

      <div className="p-7">
        <div className="rounded-xl border border-ink-20 bg-white overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-ink-60">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading cases…</span>
            </div>
          ) : isError ? (
            <ApiErrorState
              error={error}
              fallback="Failed to load cases. Please try again."
              onRetry={() => void refetch()}
            />
          ) : cases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <p className="text-sm text-ink-60">No cases yet.</p>
              <p className="text-xs text-ink-60">
                Create a client first, then add a case from their profile.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-20 bg-ink-08">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Client
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    LTV
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Stage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-20">
                {cases.map((caseItem) => (
                  <tr key={caseItem.id} className="hover:bg-ink-08 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-ink-60">
                        {caseItem.referenceNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/clients/${caseItem.clientId}`}
                        className="font-medium text-ink hover:text-brand-teal-700"
                      >
                        {formatClientName(caseItem.client)}
                      </Link>
                      <div className="text-xs text-ink-60">{caseItem.client.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-60">
                      {TYPE_LABELS[caseItem.type] ?? caseItem.type}
                    </td>
                    <td className="px-5 py-3.5 text-ink-60">
                      {formatMoney(caseItem.loanAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-ink-60">
                      {caseItem.ltv != null ? `${caseItem.ltv}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-full bg-brand-teal-50 px-2 py-0.5 text-xs font-medium text-brand-teal-700">
                        {STAGE_LABELS[caseItem.stage] ?? caseItem.stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
