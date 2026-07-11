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
import { useAdvisers } from '@/hooks/use-settings';
import { AddClientModal } from '@/components/dashboard/add-client-modal';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import {
  formatClientEmployment,
  formatClientInitials,
  formatClientName,
} from '@/lib/api/client-display';
import type {
  ClientCategoryFilter,
  ClientStatus,
  EmploymentStatus,
} from '@/lib/api/client';

const PER_PAGE = 10;

const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  EMPLOYED: 'Employed',
  SELF_EMPLOYED: 'Self Employed',
  CONTRACTOR: 'Contractor',
  RETIRED: 'Retired',
  UNEMPLOYED: 'Unemployed',
};

const STATUS_LABELS: Record<ClientStatus, string> = {
  PROSPECT: 'Prospect',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

const STATUS_STYLES: Record<ClientStatus, string> = {
  PROSPECT: 'bg-sky-50 text-sky-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-ink-08 text-ink-60',
};

const CATEGORY_LABELS: Record<ClientCategoryFilter, string> = {
  REFERRAL: 'Referral',
  INDIVIDUAL: 'Individual',
  COMPANY: 'Company',
};

function formatAdviserName(member: { firstName: string; lastName: string } | null) {
  if (!member) return '—';
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || '—';
}

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | ''>('');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentStatus | ''>('');
  const [clientCategoryFilter, setClientCategoryFilter] = useState<ClientCategoryFilter | ''>('');
  const [adviserFilter, setAdviserFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [, startTransition] = useTransition();

  const { data: advisersData } = useAdvisers();
  const activeAdvisers = (advisersData?.data ?? []).filter((adviser) => adviser.isActive);

  const { data, isLoading, isError, error, refetch } = useClients({
    page,
    perPage: PER_PAGE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    employmentStatus: employmentFilter || undefined,
    clientCategory: clientCategoryFilter || undefined,
    assignedMemberId: adviserFilter || undefined,
  });

  const clients = data?.data ?? [];
  const meta = data?.meta;
  const totalCount = meta?.total ?? 0;
  const totalPages =
    totalCount > 0 ? Math.ceil(totalCount / (meta?.perPage ?? PER_PAGE)) : 1;

  function handleSearchChange(value: string) {
    setSearch(value);
    startTransition(() => {
      setDebouncedSearch(value);
      setPage(1);
    });
  }

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setEmploymentFilter('');
    setClientCategoryFilter('');
    setAdviserFilter('');
    setPage(1);
  }

  const activeFilterCount =
    Number(Boolean(statusFilter)) +
    Number(Boolean(employmentFilter)) +
    Number(Boolean(clientCategoryFilter)) +
    Number(Boolean(adviserFilter));

  const hasActiveFilters =
    debouncedSearch ||
    statusFilter ||
    employmentFilter ||
    clientCategoryFilter ||
    adviserFilter;

  return (
    <>
      <AddClientModal open={addOpen} onClose={() => setAddOpen(false)} />

      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[15px] font-bold text-ink">Clients</h1>
          {totalCount > 0 && (
            <span className="rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
              {totalCount}
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
              showFilters || activeFilterCount > 0
                ? 'border-brand-teal-500 bg-brand-teal-50 text-brand-teal-700'
                : 'border-ink-20 bg-white text-ink-60 hover:border-ink-60 hover:text-ink',
            ].join(' ')}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-teal-500 px-1.5 py-0 text-[10px] font-bold text-white leading-5">
                {activeFilterCount}
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

        {showFilters && (
          <div className="rounded-lg border border-ink-20 bg-white p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-60">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as ClientStatus | '');
                    resetPage();
                  }}
                  className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
                >
                  <option value="">All statuses</option>
                  {(Object.entries(STATUS_LABELS) as [ClientStatus, string][]).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-60">
                  Employment
                </label>
                <select
                  value={employmentFilter}
                  onChange={(e) => {
                    setEmploymentFilter(e.target.value as EmploymentStatus | '');
                    resetPage();
                  }}
                  className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
                >
                  <option value="">All employment</option>
                  {(Object.entries(EMPLOYMENT_LABELS) as [EmploymentStatus, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-60">
                  Client type
                </label>
                <select
                  value={clientCategoryFilter}
                  onChange={(e) => {
                    setClientCategoryFilter(e.target.value as ClientCategoryFilter | '');
                    resetPage();
                  }}
                  className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
                >
                  <option value="">All types</option>
                  {(Object.entries(CATEGORY_LABELS) as [ClientCategoryFilter, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-60">
                  Adviser
                </label>
                <select
                  value={adviserFilter}
                  onChange={(e) => {
                    setAdviserFilter(e.target.value);
                    resetPage();
                  }}
                  className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20 min-w-[180px]"
                >
                  <option value="">All advisers</option>
                  {activeAdvisers.map((adviser) => (
                    <option key={adviser.id} value={adviser.id}>
                      {[adviser.firstName, adviser.lastName].filter(Boolean).join(' ') || adviser.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

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
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Reference
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Employment
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Insurance
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                    Adviser
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
                {clients.map((client) => {
                  const category: ClientCategoryFilter = client.isReferred
                    ? 'REFERRAL'
                    : client.clientType === 'COMPANY'
                      ? 'COMPANY'
                      : 'INDIVIDUAL';

                  return (
                    <tr key={client.id} className="group hover:bg-ink-08 transition-colors">
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
                        <div className="flex flex-col gap-1">
                          <span
                            className={[
                              'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              category === 'COMPANY'
                                ? 'bg-indigo-50 text-indigo-700'
                                : category === 'REFERRAL'
                                  ? 'bg-amber/10 text-amber'
                                  : 'bg-brand-teal-50 text-brand-teal-700',
                            ].join(' ')}
                          >
                            {CATEGORY_LABELS[category]}
                          </span>
                          {client.isReferred && client.referredToCompany && (
                            <span className="text-xs text-ink-60" title={client.referredToCompany}>
                              {client.referredToCompany}
                            </span>
                          )}
                        </div>
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
                        {client.insurerName ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_STYLES[client.status],
                          ].join(' ')}
                        >
                          {STATUS_LABELS[client.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-ink-60">
                        {formatAdviserName(client.assignedMember)}
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {totalCount > 0 && (
          <div className="flex items-center justify-between text-sm text-ink-60">
            <span>
              Showing {(page - 1) * PER_PAGE + 1}–
              {Math.min(page * PER_PAGE, totalCount)} of {totalCount}
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
