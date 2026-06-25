'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Search,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useClients } from '@/hooks/use-clients';
import { AddClientModal } from '@/components/dashboard/add-client-modal';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import {
  formatClientEmployment,
  formatClientInitials,
  formatClientName,
} from '@/lib/api/client-display';
import type { EmploymentStatus } from '@/lib/api/client';

const PER_PAGE = 25;

const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  EMPLOYED: 'Employed',
  SELF_EMPLOYED: 'Self Employed',
  CONTRACTOR: 'Contractor',
  RETIRED: 'Retired',
  UNEMPLOYED: 'Unemployed',
};

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentStatus | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [, startTransition] = useTransition();

  const { data, isLoading, isError, error, refetch } = useClients({
    page,
    perPage: PER_PAGE,
    search: debouncedSearch || undefined,
    employmentStatus: (employmentFilter as EmploymentStatus) || undefined,
  });

  const clients = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta ? Math.ceil(meta.total / meta.perPage) : 1;

  function handleSearchChange(value: string) {
    setSearch(value);
    startTransition(() => {
      setDebouncedSearch(value);
      setPage(1);
    });
  }

  function handleFilterChange(value: EmploymentStatus | '') {
    setEmploymentFilter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setEmploymentFilter('');
    setPage(1);
  }

  const hasActiveFilters = debouncedSearch || employmentFilter;

  return (
    <>
      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Page header */}
      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[15px] font-bold text-ink">Clients</h1>
          {meta && (
            <span className="rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
              {meta.total}
            </span>
          )}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-brand-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-teal-700 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Add client
        </button>
      </div>

      <div className="p-7 space-y-4">
        {/* Search + filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-60" />
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search name, email, reference…"
              className="w-full rounded-lg border border-ink-20 bg-white py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-60 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={[
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition',
              showFilters || employmentFilter
                ? 'border-brand-teal-500 bg-brand-teal-50 text-brand-teal-700'
                : 'border-ink-20 bg-white text-ink-60 hover:border-ink-60 hover:text-ink',
            ].join(' ')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {employmentFilter && (
              <span className="rounded-full bg-brand-teal-500 px-1.5 py-0 text-[10px] font-bold text-white leading-5">
                1
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-ink-60 hover:text-ink underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="rounded-lg border border-ink-20 bg-white p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-60">
                  Employment status
                </label>
                <select
                  value={employmentFilter}
                  onChange={(e) => handleFilterChange(e.target.value as EmploymentStatus | '')}
                  className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
                >
                  <option value="">All statuses</option>
                  {(Object.entries(EMPLOYMENT_LABELS) as [EmploymentStatus, string][]).map(
                    ([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-ink-20 bg-white overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-ink-60">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading clients…</span>
            </div>
          ) : isError ? (
            <ApiErrorState
              error={error}
              fallback="Failed to load clients. Please try again."
              onRetry={() => void refetch()}
            />
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <p className="text-sm text-ink-60">
                {hasActiveFilters ? 'No clients match your filters.' : 'No clients yet.'}
              </p>
              {!hasActiveFilters && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="mt-1 text-sm font-medium text-brand-teal-700 hover:underline"
                >
                  Add your first client
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-20 bg-ink-08">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Client
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Employment
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Annual income
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Cases
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-20">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="group hover:bg-ink-08 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-teal-50 text-xs font-bold text-brand-teal-700">
                          {formatClientInitials(client)}
                        </div>
                        <div>
                          <div className="font-medium text-ink group-hover:text-brand-teal-700 transition-colors">
                            {formatClientName(client)}
                          </div>
                          <div className="text-xs text-ink-60">{client.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-ink-60">
                        {client.referenceNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-60">
                      {formatClientEmployment(client)}
                    </td>
                    <td className="px-5 py-3.5 text-ink-60">
                      {client.annualIncome != null
                        ? `£${client.annualIncome.toLocaleString('en-GB')}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
                        {client._count.cases}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {client.isVulnerable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber">
                          <AlertTriangle className="h-3 w-3" />
                          Vulnerable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {meta && meta.total > PER_PAGE && (
          <div className="flex items-center justify-between text-sm text-ink-60">
            <span>
              Showing {(page - 1) * PER_PAGE + 1}–
              {Math.min(page * PER_PAGE, meta.total)} of {meta.total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-20 bg-white text-ink disabled:opacity-40 hover:bg-ink-08 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-20 bg-white text-ink disabled:opacity-40 hover:bg-ink-08 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
