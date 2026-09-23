'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import {
  clientsApi,
  formatApiError,
  requireAuthToken,
  type AdviserRecord,
  type ClientProperty,
  type ClientStatus,
  type ClientSummary,
  type EmploymentStatus,
  type UpdateClientInput,
} from '@/lib/api/client';
import { listClientProperties, upsertCaseProperty, type PropertyDraft } from '@/lib/cases/prd16-store';

const INSURERS = [
  'Aviva',
  'Legal & General',
  'Scottish Widows',
  'Royal London',
  'Zurich',
  'LV=',
  'Vitality',
  'AIG',
  'MetLife',
  'Other',
];

const EMPLOYMENT_OPTIONS: Array<{ value: EmploymentStatus; label: string }> = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const STATUS_OPTIONS: Array<{ value: ClientStatus; label: string }> = [
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type FormState = {
  firstName: string;
  lastName: string;
  companyName: string;
  companyNumber: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  employmentStatus: EmploymentStatus;
  annualIncome: string;
  insurerName: string;
  assignedMemberId: string;
  status: ClientStatus;
};

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const raw = typeof value === 'string' ? value : value.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const iso = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
}

function line1FromAddress(address: ClientProperty['address']): string | undefined {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return undefined;
  const line1 = (address as { line1?: unknown }).line1;
  return typeof line1 === 'string' && line1.trim() ? line1.trim() : undefined;
}

function propertyToDraft(home: ClientProperty, clientId: string): PropertyDraft {
  return {
    id: home.id,
    clientId: home.clientId || clientId,
    postcode: home.postcode,
    line1: line1FromAddress(home.address),
    value: home.currentValue != null ? String(home.currentValue) : undefined,
  };
}

function parseIncome(raw: string): number | undefined {
  const stripped = raw.replace(/[£,\s]/g, '');
  if (!stripped) return undefined;
  const parsed = Number(stripped);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formFromClient(client: Partial<ClientSummary> & {
  phone?: string;
  dateOfBirth?: string;
  companyNumber?: string;
}): FormState {
  return {
    firstName: client.firstName ?? '',
    lastName: client.lastName === '—' ? '' : (client.lastName ?? ''),
    companyName: client.companyName ?? '',
    companyNumber: client.companyNumber ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    dateOfBirth: toDateInput(client.dateOfBirth),
    employmentStatus: client.employmentStatus ?? 'EMPLOYED',
    annualIncome: client.annualIncome != null ? String(client.annualIncome) : '',
    insurerName: client.insurerName ?? '',
    assignedMemberId: client.assignedMember?.id ?? '',
    status: client.status ?? 'PROSPECT',
  };
}

const fieldClass =
  'min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-ink outline-none focus:border-brand-teal-500';

export function EditClientModal({
  clientId,
  initialClient,
  advisers,
  onClose,
  onSaved,
}: {
  clientId: string;
  initialClient?: ClientSummary;
  advisers: AdviserRecord[];
  onClose: () => void;
  onSaved: (client: ClientSummary) => void;
}) {
  const { getToken } = useAuth();
  const [form, setForm] = useState<FormState>(() => formFromClient(initialClient ?? {}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientType, setClientType] = useState<'INDIVIDUAL' | 'COMPANY'>(
    initialClient?.clientType ?? 'INDIVIDUAL',
  );
  const [referenceNumber, setReferenceNumber] = useState(initialClient?.referenceNumber ?? '');
  const [loaded, setLoaded] = useState<ClientSummary | null>(initialClient ?? null);
  const [properties, setProperties] = useState<PropertyDraft[]>([]);
  const [newPostcode, setNewPostcode] = useState('');
  const [newLine1, setNewLine1] = useState('');
  const [propertyMsg, setPropertyMsg] = useState<string | null>(null);

  const isCompany = clientType === 'COMPANY';
  const activeAdvisers = useMemo(
    () => advisers.filter((adviser) => adviser.isActive !== false),
    [advisers],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await requireAuthToken(getToken);
        const response = await clientsApi.get(token, clientId);
        if (cancelled) return;
        const data = response.data;
        setClientType(data.clientType === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL');
        setReferenceNumber(data.referenceNumber);
        const summary: ClientSummary = {
          id: data.id,
          referenceNumber: data.referenceNumber,
          clientType: data.clientType ?? 'INDIVIDUAL',
          companyName: data.companyName,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          employmentStatus: data.employmentStatus,
          annualIncome: data.annualIncome,
          isReferred: data.isReferred,
          referredToCompany: data.referredToCompany,
          status: data.status,
          insurerName: data.insurerName,
          isVulnerable: data.isVulnerable,
          assignedMember: data.assignedMember,
          _count: { cases: initialClient?._count.cases ?? data.cases?.length ?? 0, messages: data._count?.messages ?? 0 },
        };
        setLoaded(summary);
        setForm(formFromClient({ ...data, ...summary }));
        try {
          const listed = await clientsApi.listProperties(token, clientId);
          const apiHomes = listed.data?.length ? listed.data : (data.properties ?? []);
          if (apiHomes.length) {
            setProperties(apiHomes.map((home) => propertyToDraft(home, clientId)));
          } else {
            setProperties(listClientProperties(clientId));
          }
        } catch {
          if (data.properties?.length) {
            setProperties(data.properties.map((home) => propertyToDraft(home, clientId)));
          } else {
            setProperties(listClientProperties(clientId));
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (initialClient) {
          setLoaded(initialClient);
          setForm(formFromClient(initialClient));
          setProperties(listClientProperties(clientId));
        } else {
          setError(formatApiError(err, { fallback: 'Could not load this client.' }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // initialClient is first-paint only; GET is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, getToken]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function addProperty() {
    const postcode = newPostcode.trim();
    if (!postcode) {
      setPropertyMsg('Postcode is required.');
      return;
    }
    const line1 = newLine1.trim() || undefined;
    setPropertyMsg(null);
    try {
      const token = await requireAuthToken(getToken);
      const created = await clientsApi.createProperty(token, clientId, {
        postcode,
        ...(line1 ? { address: { line1 } } : {}),
      });
      const draft = propertyToDraft(created.data, clientId);
      upsertCaseProperty(draft);
      setProperties((current) => {
        if (current.some((home) => home.id === draft.id)) {
          return current.map((home) => (home.id === draft.id ? draft : home));
        }
        return [...current, draft];
      });
      setNewPostcode('');
      setNewLine1('');
      setPropertyMsg('Saved.');
    } catch {
      upsertCaseProperty({
        id: `prop_${Date.now()}`,
        clientId,
        postcode,
        line1,
      });
      setProperties(listClientProperties(clientId));
      setNewPostcode('');
      setNewLine1('');
      setPropertyMsg('Saved on this device. Cases for this client can reuse this home.');
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const email = form.email.trim();
    if (!email) {
      setError('Email is required.');
      return;
    }
    if (isCompany && !form.companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!isCompany && (!form.firstName.trim() || !form.lastName.trim())) {
      setError('First name and last name are required.');
      return;
    }

    const income = parseIncome(form.annualIncome);
    if (form.annualIncome.trim() && income == null) {
      setError('Enter a valid annual income, or leave it blank.');
      return;
    }

    const payload: UpdateClientInput = {
      email,
      phone: form.phone.trim() || undefined,
      status: form.status,
      assignedMemberId: form.assignedMemberId || null,
      insurerName: isCompany ? undefined : form.insurerName.trim(),
      dateOfBirth: isCompany ? undefined : form.dateOfBirth || undefined,
      employmentStatus: isCompany ? undefined : form.employmentStatus,
    };
    if (income != null) payload.annualIncome = income;
    if (isCompany) {
      payload.companyName = form.companyName.trim();
      payload.companyNumber = form.companyNumber.trim() || undefined;
    } else {
      payload.firstName = form.firstName.trim();
      payload.lastName = form.lastName.trim();
    }

    setSaving(true);
    setError(null);
    try {
      const token = await requireAuthToken(getToken);
      await clientsApi.update(token, clientId, payload);
      const adviser = activeAdvisers.find(
        (item) => (item.memberId ?? item.id) === form.assignedMemberId,
      );
      const next: ClientSummary = {
        id: clientId,
        referenceNumber: referenceNumber || loaded?.referenceNumber || '',
        clientType: clientType,
        companyName: isCompany ? form.companyName.trim() : loaded?.companyName,
        firstName: isCompany ? form.companyName.trim() : form.firstName.trim(),
        lastName: isCompany ? '—' : form.lastName.trim(),
        email,
        employmentStatus: isCompany ? loaded?.employmentStatus ?? 'EMPLOYED' : form.employmentStatus,
        annualIncome: income ?? loaded?.annualIncome,
        isReferred: loaded?.isReferred ?? false,
        referredToCompany: loaded?.referredToCompany,
        status: form.status,
        insurerName: isCompany ? loaded?.insurerName : form.insurerName.trim() || undefined,
        isVulnerable: loaded?.isVulnerable ?? false,
        assignedMember: adviser
          ? {
              id: adviser.memberId ?? adviser.id,
              firstName: adviser.firstName ?? '',
              lastName: adviser.lastName ?? '',
            }
          : null,
        _count: loaded?._count ?? { cases: 0, messages: 0 },
      };
      onSaved(next);
      onClose();
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Could not save client details.' }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-client-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 id="edit-client-title" className="font-display text-lg font-bold text-ink">
              Edit client
            </h2>
            <p className="mt-0.5 text-xs text-[#71717a]">
              {referenceNumber ? `${referenceNumber} · ` : ''}
              Add missing details such as the assigned adviser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 min-w-11 text-xl leading-none text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center px-6 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-teal-500" />
          </div>
        ) : (
          <form onSubmit={(event) => void handleSave(event)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
              {isCompany ? (
                <>
                  <label className="block text-sm font-medium text-ink">
                    Company name *
                    <input
                      className={`${fieldClass} mt-1`}
                      value={form.companyName}
                      onChange={(event) => update('companyName', event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Company number
                    <input
                      className={`${fieldClass} mt-1`}
                      value={form.companyNumber}
                      onChange={(event) => update('companyNumber', event.target.value)}
                    />
                  </label>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-ink">
                    First name *
                    <input
                      className={`${fieldClass} mt-1`}
                      value={form.firstName}
                      onChange={(event) => update('firstName', event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Last name *
                    <input
                      className={`${fieldClass} mt-1`}
                      value={form.lastName}
                      onChange={(event) => update('lastName', event.target.value)}
                    />
                  </label>
                </div>
              )}

              <label className="block text-sm font-medium text-ink">
                Email *
                <input
                  type="email"
                  className={`${fieldClass} mt-1`}
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                />
              </label>

              <label className="block text-sm font-medium text-ink">
                Phone
                <input
                  className={`${fieldClass} mt-1`}
                  value={form.phone}
                  onChange={(event) => update('phone', event.target.value)}
                />
              </label>

              {!isCompany && (
                <>
                  <label className="block text-sm font-medium text-ink">
                    Date of birth
                    <input
                      type="date"
                      className={`${fieldClass} mt-1`}
                      value={form.dateOfBirth}
                      onChange={(event) => update('dateOfBirth', event.target.value)}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Employment
                    <select
                      className={`${fieldClass} mt-1`}
                      value={form.employmentStatus}
                      onChange={(event) => update('employmentStatus', event.target.value as EmploymentStatus)}
                    >
                      {EMPLOYMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <label className="block text-sm font-medium text-ink">
                Annual income
                <input
                  className={`${fieldClass} mt-1`}
                  value={form.annualIncome}
                  onChange={(event) => update('annualIncome', event.target.value)}
                  placeholder="e.g. 65000"
                />
              </label>

              {!isCompany && (
                <label className="block text-sm font-medium text-ink">
                  Insurer
                  <select
                    className={`${fieldClass} mt-1`}
                    value={form.insurerName}
                    onChange={(event) => update('insurerName', event.target.value)}
                  >
                    <option value="">None</option>
                    {INSURERS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    {form.insurerName && !INSURERS.includes(form.insurerName) ? (
                      <option value={form.insurerName}>{form.insurerName}</option>
                    ) : null}
                  </select>
                </label>
              )}

              <label className="block text-sm font-medium text-ink">
                Adviser
                <select
                  className={`${fieldClass} mt-1`}
                  value={form.assignedMemberId}
                  onChange={(event) => update('assignedMemberId', event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {loaded?.assignedMember &&
                  !activeAdvisers.some(
                    (adviser) => (adviser.memberId ?? adviser.id) === loaded.assignedMember?.id,
                  ) ? (
                    <option value={loaded.assignedMember.id}>
                      {[loaded.assignedMember.firstName, loaded.assignedMember.lastName]
                        .filter(Boolean)
                        .join(' ') || 'Current adviser'}
                    </option>
                  ) : null}
                  {activeAdvisers.map((adviser) => {
                    const id = adviser.memberId ?? adviser.id;
                    const label =
                      [adviser.firstName, adviser.lastName].filter(Boolean).join(' ') ||
                      adviser.email ||
                      'Adviser';
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="block text-sm font-medium text-ink">
                Status
                <select
                  className={`${fieldClass} mt-1`}
                  value={form.status}
                  onChange={(event) => update('status', event.target.value as ClientStatus)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <section className="rounded-xl border border-gray-100 bg-[#fafafa] p-3">
                <h3 className="text-sm font-semibold text-ink">Properties</h3>
                <p className="mt-0.5 text-xs text-[#71717a]">
                  Stored on this client. There is no Properties item in nav.
                </p>
                {properties.length === 0 ? (
                  <p className="mt-2 text-xs text-[#a1a1aa]">No property recorded yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {properties.map((home) => (
                      <li
                        key={home.id}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-ink"
                      >
                        <strong>{home.postcode}</strong>
                        {home.line1 ? ` · ${home.line1}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-ink">
                    Postcode
                    <input
                      className={`${fieldClass} mt-1`}
                      value={newPostcode}
                      onChange={(event) => setNewPostcode(event.target.value)}
                      placeholder="SW1A 2AA"
                      autoComplete="postal-code"
                    />
                  </label>
                  <label className="block text-xs font-medium text-ink">
                    Address (optional)
                    <input
                      className={`${fieldClass} mt-1`}
                      value={newLine1}
                      onChange={(event) => setNewLine1(event.target.value)}
                      placeholder="14 Maple Avenue"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addProperty}
                  className="mt-2 min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-ink hover:bg-gray-50"
                >
                  Add property
                </button>
                {propertyMsg ? <p className="mt-2 text-xs text-[#52525b]">{propertyMsg}</p> : null}
              </section>

              {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="min-h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-teal-500 px-4 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
