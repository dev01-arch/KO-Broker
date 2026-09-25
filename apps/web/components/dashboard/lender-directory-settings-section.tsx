'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Landmark, Loader2, Plus } from 'lucide-react';
import {
  useAddLender,
  useAdminLenders,
  useLenderOtherUsage,
} from '@/hooks/use-settings';
import { useIsAdmin, useOrgRole } from '@/hooks/use-org';
import { formatApiError, type AddLenderStatus, type LenderOtherUsageRow } from '@/lib/api/client';
import {
  OTHER_USAGE_REVIEW_THRESHOLD,
  computeAdminLenderMeta,
  countPendingOtherUsageReview,
  isPendingOtherUsageReview,
} from '@/lib/lenders/admin-directory';

const FCA_REGISTER_URL = 'https://register.fca.org.uk/s/';

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusClass(status: string): string {
  if (status === 'ACTIVE') return 'bg-green/10 text-green';
  if (status === 'LEGACY') return 'bg-amber/10 text-amber';
  return 'bg-ink-08 text-ink-60';
}

export function LenderDirectorySettingsSection() {
  const orgRole = useOrgRole();
  const isAdmin = useIsAdmin();
  const {
    data: lendersResponse,
    isLoading: lendersLoading,
    error: lendersError,
  } = useAdminLenders({ enabled: isAdmin });
  const {
    data: otherUsageResponse,
    isLoading: otherUsageLoading,
    error: otherUsageError,
  } = useLenderOtherUsage({ enabled: isAdmin });
  const { mutateAsync: addLender, isPending: addingLender } = useAddLender();

  const [name, setName] = useState('');
  const [fcaFrn, setFcaFrn] = useState('');
  const [status, setStatus] = useState<AddLenderStatus>('ACTIVE');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState<'all' | 'missing-frn' | 'inactive'>('all');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const lenders = lendersResponse?.data ?? [];
  const otherUsage = otherUsageResponse?.data ?? [];
  const meta = lendersResponse?.meta
    ? {
        total: lendersResponse.meta.total ?? lenders.length,
        active: lendersResponse.meta.active ?? 0,
        legacy: lendersResponse.meta.legacy ?? 0,
        inactive: lendersResponse.meta.inactive ?? 0,
        withFrn: lendersResponse.meta.withFrn ?? 0,
      }
    : computeAdminLenderMeta(lenders);
  const pendingReviewCount =
    otherUsageResponse?.meta?.pendingReview ??
    otherUsage.filter((row) => !row.alreadyInDirectory).length;
  const actionNeededCount = countPendingOtherUsageReview(otherUsage);

  const filteredDirectory = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase();
    return lenders.filter((lender) => {
      if (directoryFilter === 'missing-frn' && lender.fcaFrn) return false;
      if (directoryFilter === 'inactive' && lender.status !== 'INACTIVE') return false;
      if (!query) return true;
      return (
        lender.name.toLowerCase().includes(query) ||
        (lender.fcaFrn ?? '').toLowerCase().includes(query)
      );
    });
  }, [directoryFilter, directoryQuery, lenders]);

  if (orgRole === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-60">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading lender directory…
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  function prefillFromOtherName(row: LenderOtherUsageRow) {
    setName(row.name);
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleAddLender() {
    const trimmedName = name.trim();
    const trimmedFrn = fcaFrn.trim();
    if (trimmedName.length < 2) {
      setFormError('Lender name must be at least 2 characters.');
      return;
    }
    if (trimmedFrn && !/^\d{6,7}$/.test(trimmedFrn)) {
      setFormError('FRN should be the 6–7 digit number from the FCA register.');
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    try {
      const created = await addLender({
        name: trimmedName,
        status,
        ...(trimmedFrn ? { fcaFrn: trimmedFrn } : {}),
      });
      setFormSuccess(`${created.data.name} is now in the directory and available in adviser search.`);
      setName('');
      setFcaFrn('');
      setStatus('ACTIVE');
    } catch (error) {
      setFormError(formatApiError(error));
    }
  }

  const loadError = lendersError || otherUsageError;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-60">
        Review names advisers entered as Other, confirm the firm on the FCA register, then add it
        here. Inactive lenders stay out of adviser search. FRN backfill for seed names is a
        database task, not a change to case or product flows.
      </p>

      {loadError ? (
        <div className="flex items-center gap-2 rounded-lg bg-red/10 px-4 py-3 text-sm text-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {formatApiError(loadError)}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total', value: meta.total },
          { label: 'Active', value: meta.active },
          { label: 'Legacy', value: meta.legacy },
          { label: 'Inactive', value: meta.inactive },
          { label: 'With FRN', value: meta.withFrn },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-ink-20 bg-ink-08/40 px-4 py-3">
            <p className="text-xs font-medium text-ink-60">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold text-ink">
              {lendersLoading ? '—' : stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-ink-20 bg-white p-6">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Landmark className="h-4 w-4 text-brand-teal-500" />
          <h3 className="font-heading text-sm font-bold text-ink">Other usage</h3>
          {!otherUsageLoading ? (
            <span className="rounded-full bg-amber/10 px-2.5 py-0.5 text-xs font-medium text-amber">
              {actionNeededCount} to review (count ≥ {OTHER_USAGE_REVIEW_THRESHOLD})
            </span>
          ) : null}
        </div>
        <p className="mb-4 text-sm text-ink-60">
          {pendingReviewCount} name{pendingReviewCount === 1 ? '' : 's'} not yet in the directory.
          Confirm authorised status and mortgage permission on the{' '}
          <a
            href={FCA_REGISTER_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand-teal-700 hover:underline"
          >
            FCA register
            <ExternalLink className="h-3 w-3" />
          </a>
          , then add the firm below.
        </p>
        {otherUsageLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Other usage…
          </div>
        ) : otherUsage.length === 0 ? (
          <p className="text-sm text-ink-60">No Other-field names recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-08 text-xs font-medium text-ink-60">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Count</th>
                  <th className="py-2 pr-3 font-medium">Directory</th>
                  <th className="py-2 pr-3 font-medium">Last seen</th>
                  <th className="py-2 pr-3 font-medium">Cases</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {otherUsage.map((row) => {
                  const pending = isPendingOtherUsageReview(row);
                  return (
                    <tr
                      key={row.normalizedName || row.name}
                      className={`border-b border-ink-08 last:border-0 ${pending ? 'bg-amber/5' : ''}`}
                    >
                      <td className="py-2.5 pr-3 font-medium text-ink">{row.name}</td>
                      <td className="py-2.5 pr-3 text-ink">{row.count}</td>
                      <td className="py-2.5 pr-3">
                        {row.alreadyInDirectory ? (
                          <span className="rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-green">
                            In directory
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber">
                            Needs review
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-60">{formatShortDate(row.lastSeen)}</td>
                      <td className="py-2.5 pr-3 text-ink-60">{row.caseRefs.slice(0, 3).join(', ')}</td>
                      <td className="py-2.5 text-right">
                        {!row.alreadyInDirectory ? (
                          <button
                            type="button"
                            onClick={() => prefillFromOtherName(row)}
                            className="text-xs font-medium text-brand-teal-700 hover:underline"
                          >
                            Use name
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-ink-20 bg-white p-6">
        <div className="mb-1 flex items-center gap-2">
          <Plus className="h-4 w-4 text-brand-teal-500" />
          <h3 className="font-heading text-sm font-bold text-ink">Add lender</h3>
        </div>
        <p className="mb-4 text-sm text-ink-60">
          Use the exact FCA register name. ACTIVE and LEGACY appear in adviser search immediately.
          INACTIVE names cannot be re-added here — reactivate the existing row instead.
        </p>
        {formError ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red/10 px-4 py-3 text-sm text-red">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {formError}
          </div>
        ) : null}
        {formSuccess ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-brand-teal-50 px-4 py-3 text-sm text-brand-teal-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {formSuccess}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Lender name"
            className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          />
          <input
            value={fcaFrn}
            onChange={(event) => setFcaFrn(event.target.value)}
            placeholder="FRN (recommended)"
            inputMode="numeric"
            className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AddLenderStatus)}
            className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="LEGACY">LEGACY — closed brand</option>
          </select>
        </div>
        <button
          type="button"
          disabled={addingLender || name.trim().length < 2}
          onClick={() => void handleAddLender()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addingLender ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {addingLender ? 'Adding lender…' : 'Add lender'}
        </button>
      </section>

      <section className="rounded-xl border border-ink-20 bg-white p-6">
        <h3 className="font-heading text-sm font-bold text-ink">Directory</h3>
        <p className="mb-4 mt-1 text-sm text-ink-60">
          Includes INACTIVE rows for operations. Advisers only search ACTIVE and LEGACY names.
        </p>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={directoryQuery}
            onChange={(event) => setDirectoryQuery(event.target.value)}
            placeholder="Search name or FRN"
            className="flex-1 rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          />
          <select
            value={directoryFilter}
            onChange={(event) =>
              setDirectoryFilter(event.target.value as 'all' | 'missing-frn' | 'inactive')
            }
            className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          >
            <option value="all">All statuses</option>
            <option value="missing-frn">Missing FRN</option>
            <option value="inactive">INACTIVE only</option>
          </select>
        </div>
        {lendersLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading directory…
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-ink-08 text-xs font-medium text-ink-60">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">FRN</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirectory.map((lender) => (
                  <tr key={lender.id} className="border-b border-ink-08 last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">{lender.name}</td>
                    <td className="py-2 pr-3 text-ink-60">{lender.fcaFrn ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(lender.status)}`}>
                        {lender.status}
                      </span>
                    </td>
                    <td className="py-2 text-ink-60">{formatShortDate(lender.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDirectory.length === 0 ? (
              <p className="py-4 text-sm text-ink-60">No lenders match this filter.</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
