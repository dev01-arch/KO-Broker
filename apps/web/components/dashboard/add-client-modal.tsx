'use client';

import { useState, type FormEvent } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  DollarSign,
  Loader2,
  Building2,
  Hash,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { useCreateClient } from '@/hooks/use-clients';
import { useAdvisers } from '@/hooks/use-settings';
import {
  formatApiError,
  getApiErrorFieldMap,
  type ClientType,
  type EmploymentStatus,
} from '@/lib/api/client';
import { INSURER_OPTIONS } from '@/lib/constants/insurers';

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
}

type IndividualStep = 'referral' | 'referred-company' | 'details';

const EMPLOYMENT_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: 'EMPLOYED', label: 'Employed' },
  { value: 'SELF_EMPLOYED', label: 'Self Employed' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
];

const CLIENT_TYPE_OPTIONS: { value: ClientType; label: string; description: string }[] = [
  {
    value: 'INDIVIDUAL',
    label: 'Individual',
    description: 'Personal mortgage client',
  },
  {
    value: 'COMPANY',
    label: 'Company',
    description: 'Limited company entity',
  },
];

function isPositiveNumber(value: string): boolean {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

export function AddClientModal({ open, onClose }: AddClientModalProps) {
  const { mutateAsync, isPending } = useCreateClient();
  const { data: advisersData, isLoading: advisersLoading } = useAdvisers();
  const activeAdvisers = (advisersData?.data ?? []).filter((adviser) => adviser.isActive);

  const [clientType, setClientType] = useState<ClientType>('INDIVIDUAL');
  const [individualStep, setIndividualStep] = useState<IndividualStep>('referral');
  const [isReferred, setIsReferred] = useState<boolean | null>(null);
  const [referredToCompany, setReferredToCompany] = useState('');
  const [assignedMemberId, setAssignedMemberId] = useState('');
  const [hasInsurer, setHasInsurer] = useState(false);
  const [insurerName, setInsurerName] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    companyNumber: '',
    email: '',
    title: '',
    phone: '',
    dateOfBirth: '',
    employmentStatus: '' as EmploymentStatus | '',
    annualIncome: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const isCompany = clientType === 'COMPANY';
  const showReferralStep = !isCompany && individualStep === 'referral';
  const showReferredCompanyStep = !isCompany && individualStep === 'referred-company';
  const showDetailsForm = isCompany || individualStep === 'details';

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleClientTypeChange(nextType: ClientType) {
    setClientType(nextType);
    setIndividualStep('referral');
    setIsReferred(null);
    setReferredToCompany('');
    setFieldErrors({});
    setGlobalError(null);
  }

  function handleReferralAnswer(referred: boolean) {
    setIsReferred(referred);
    if (!referred) {
      setReferredToCompany('');
      setIndividualStep('details');
    } else {
      setIndividualStep('referred-company');
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.isReferred;
      delete next.referredToCompany;
      return next;
    });
  }

  function handleContinueFromReferredCompany() {
    if (!referredToCompany.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        referredToCompany: 'Referred company is required',
      }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.referredToCompany;
      return next;
    });
    setIndividualStep('details');
  }

  const showInsuranceSection =
    showDetailsForm && !isCompany && isReferred === false;

  const isFormValid = isCompany
    ? Boolean(
        form.companyName.trim() &&
          form.companyNumber.trim() &&
          form.email.trim() &&
          form.phone.trim() &&
          (activeAdvisers.length === 0 || assignedMemberId),
      )
    : Boolean(
        form.firstName.trim() &&
          form.lastName.trim() &&
          form.title &&
          form.dateOfBirth &&
          form.employmentStatus &&
          form.email.trim() &&
          form.phone.trim() &&
          (!isReferred || referredToCompany.trim()) &&
          (activeAdvisers.length === 0 || assignedMemberId),
      );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setFieldErrors({});

    if (!isCompany) {
      if (individualStep === 'referral' || isReferred === null) {
        setFieldErrors({
          isReferred: 'Please indicate whether this client is being referred.',
        });
        return;
      }
      if (individualStep === 'referred-company') {
        handleContinueFromReferredCompany();
        return;
      }
    }

    if (activeAdvisers.length > 0 && !assignedMemberId) {
      setFieldErrors({ assignedMemberId: 'Please select an adviser' });
      return;
    }

    const adviserPayload = assignedMemberId ? { assignedMemberId } : {};
    const insurancePayload =
      showInsuranceSection && hasInsurer && insurerName
        ? { insurerName }
        : {};

    try {
      if (isCompany) {
        await mutateAsync({
          clientType: 'COMPANY',
          companyName: form.companyName.trim(),
          companyNumber: form.companyNumber.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          ...(form.annualIncome && isPositiveNumber(form.annualIncome)
            ? { annualIncome: Number(form.annualIncome) }
            : {}),
          ...adviserPayload,
        });
      } else {
        await mutateAsync({
          clientType: 'INDIVIDUAL',
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          title: form.title,
          phone: form.phone.trim(),
          dateOfBirth: form.dateOfBirth,
          employmentStatus: form.employmentStatus as EmploymentStatus,
          ...(form.annualIncome && isPositiveNumber(form.annualIncome)
            ? { annualIncome: Number(form.annualIncome) }
            : {}),
          isReferred: isReferred === true,
          referredToCompany: isReferred ? referredToCompany.trim() : undefined,
          ...adviserPayload,
          ...insurancePayload,
        });
      }

      handleClose();
    } catch (err) {
      const fields = getApiErrorFieldMap(err);
      if (fields) {
        setFieldErrors(fields);
      } else {
        setGlobalError(formatApiError(err, { fallback: 'Something went wrong. Please try again.' }));
      }
    }
  }

  function handleClose() {
    setClientType('INDIVIDUAL');
    setIndividualStep('referral');
    setIsReferred(null);
    setReferredToCompany('');
    setAssignedMemberId('');
    setHasInsurer(false);
    setInsurerName('');
    setForm({
      firstName: '',
      lastName: '',
      companyName: '',
      companyNumber: '',
      email: '',
      title: '',
      phone: '',
      dateOfBirth: '',
      employmentStatus: '',
      annualIncome: '',
    });
    setFieldErrors({});
    setGlobalError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-20 px-6 py-4">
          <div>
            <h2 id="add-client-title" className="font-heading text-base font-bold text-ink">
              Add new client
            </h2>
            <p className="text-xs text-ink-60">A reference number will be auto-generated</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1.5 text-ink-60 hover:bg-ink-08 hover:text-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {globalError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {globalError}
              </div>
            )}

            {/* Client type */}
            <Field label="Client type" required>
              <div className="grid grid-cols-2 gap-3">
                {CLIENT_TYPE_OPTIONS.map((option) => {
                  const selected = clientType === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleClientTypeChange(option.value)}
                      className={[
                        'rounded-lg border px-3 py-3 text-left transition',
                        selected
                          ? 'border-brand-teal-500 bg-brand-teal-50 ring-2 ring-brand-teal-500/20'
                          : 'border-ink-20 hover:border-ink-40 hover:bg-ink-08',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-2">
                        {option.value === 'COMPANY' ? (
                          <Building2 className="h-4 w-4 text-brand-teal-700" />
                        ) : (
                          <User className="h-4 w-4 text-brand-teal-700" />
                        )}
                        <span className="text-sm font-semibold text-ink">{option.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-60">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </Field>

            {showReferralStep && (
              <Field label="Is this client being referred?" required error={fieldErrors.isReferred}>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleReferralAnswer(false)}
                    className="rounded-lg border border-ink-20 px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-teal-500 hover:bg-brand-teal-50"
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReferralAnswer(true)}
                    className="rounded-lg border border-ink-20 px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand-teal-500 hover:bg-brand-teal-50"
                  >
                    Yes
                  </button>
                </div>
              </Field>
            )}

            {showReferredCompanyStep && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsReferred(null);
                    setIndividualStep('referral');
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-teal-700 hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Change referral answer
                </button>
                <Field
                  label="The company the client has been referred to"
                  required
                  error={fieldErrors.referredToCompany}
                >
                <InputWithIcon icon={<Share2 className="h-4 w-4" />}>
                  <input
                    required
                    value={referredToCompany}
                    onChange={(e) => {
                      setReferredToCompany(e.target.value);
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.referredToCompany;
                        return next;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleContinueFromReferredCompany();
                      }
                    }}
                    placeholder="e.g. ABC Mortgages Ltd"
                    className={inputCls(!!fieldErrors.referredToCompany)}
                  />
                </InputWithIcon>
                </Field>
              </>
            )}

            {showDetailsForm && !isCompany && (
              <button
                type="button"
                onClick={() =>
                  setIndividualStep(isReferred ? 'referred-company' : 'referral')
                }
                className="flex items-center gap-1.5 text-xs font-medium text-brand-teal-700 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {isReferred ? 'Change referred company' : 'Change referral answer'}
              </button>
            )}

            {showDetailsForm && isReferred && (
              <div className="rounded-lg bg-brand-teal-50 px-3 py-2.5 text-sm text-ink">
                <span className="text-ink-60">Referred to: </span>
                <span className="font-medium">{referredToCompany}</span>
              </div>
            )}

            {showDetailsForm && isCompany && (
              <>
                <Field label="Company name" required error={fieldErrors.companyName}>
                  <InputWithIcon icon={<Building2 className="h-4 w-4" />}>
                    <input
                      required
                      value={form.companyName}
                      onChange={(e) => set('companyName', e.target.value)}
                      placeholder="Acme Holdings Ltd"
                      className={inputCls(!!fieldErrors.companyName)}
                    />
                  </InputWithIcon>
                </Field>

                <Field label="Company registration number" required error={fieldErrors.companyNumber}>
                  <InputWithIcon icon={<Hash className="h-4 w-4" />}>
                    <input
                      required
                      value={form.companyNumber}
                      onChange={(e) => set('companyNumber', e.target.value)}
                      placeholder="12345678"
                      className={inputCls(!!fieldErrors.companyNumber)}
                    />
                  </InputWithIcon>
                </Field>
              </>
            )}

            {showDetailsForm && !isCompany && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First name" required error={fieldErrors.firstName}>
                    <InputWithIcon icon={<User className="h-4 w-4" />}>
                      <input
                        required
                        value={form.firstName}
                        onChange={(e) => set('firstName', e.target.value)}
                        placeholder="James"
                        className={inputCls(!!fieldErrors.firstName)}
                      />
                    </InputWithIcon>
                  </Field>
                  <Field label="Last name" required error={fieldErrors.lastName}>
                    <input
                      required
                      value={form.lastName}
                      onChange={(e) => set('lastName', e.target.value)}
                      placeholder="Osei"
                      className={inputCls(!!fieldErrors.lastName)}
                    />
                  </Field>
                </div>

                <Field label="Title" required error={fieldErrors.title}>
                  <select
                    required
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    className={selectCls(!!fieldErrors.title)}
                  >
                    <option value="">Select…</option>
                    {['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Date of birth" required error={fieldErrors.dateOfBirth}>
                  <InputWithIcon icon={<Calendar className="h-4 w-4" />}>
                    <input
                      type="date"
                      required
                      value={form.dateOfBirth}
                      onChange={(e) => set('dateOfBirth', e.target.value)}
                      className={inputCls(!!fieldErrors.dateOfBirth)}
                    />
                  </InputWithIcon>
                </Field>

                <Field label="Employment status" required error={fieldErrors.employmentStatus}>
                  <InputWithIcon icon={<Briefcase className="h-4 w-4" />}>
                    <select
                      required
                      value={form.employmentStatus}
                      onChange={(e) => set('employmentStatus', e.target.value)}
                      className={selectCls(!!fieldErrors.employmentStatus) + ' pl-10'}
                    >
                      <option value="">Select…</option>
                      {EMPLOYMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </InputWithIcon>
                </Field>
              </>
            )}

            {showDetailsForm && (
              <>
                <Field label="Email address" required error={fieldErrors.email}>
                  <InputWithIcon icon={<Mail className="h-4 w-4" />}>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder={isCompany ? 'accounts@acmeholdings.co.uk' : 'james@example.com'}
                      className={inputCls(!!fieldErrors.email)}
                    />
                  </InputWithIcon>
                </Field>

                <Field label="Phone number" required error={fieldErrors.phone}>
                  <InputWithIcon icon={<Phone className="h-4 w-4" />}>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="+44 7700 900000"
                      className={inputCls(!!fieldErrors.phone)}
                    />
                  </InputWithIcon>
                </Field>

                <Field
                  label={isCompany ? 'Annual turnover / income (£)' : 'Annual income (£)'}
                  error={fieldErrors.annualIncome}
                >
                  <InputWithIcon icon={<DollarSign className="h-4 w-4" />}>
                    <input
                      type="number"
                      min="0"
                      value={form.annualIncome}
                      onChange={(e) => set('annualIncome', e.target.value)}
                      placeholder={isCompany ? '250000' : '65000'}
                      className={inputCls(!!fieldErrors.annualIncome)}
                    />
                  </InputWithIcon>
                </Field>

                {showInsuranceSection && (
                  <div className="space-y-3 rounded-lg border border-ink-20 bg-ink-08/40 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={hasInsurer}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setHasInsurer(checked);
                          if (!checked) {
                            setInsurerName('');
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.insurerName;
                              return next;
                            });
                          }
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-ink-20 text-brand-teal-600 focus:ring-brand-teal-500/30"
                      />
                      <span className="text-sm text-ink">
                        Does the client have an insurer?
                      </span>
                    </label>

                    {hasInsurer && (
                      <Field label="Insurer" error={fieldErrors.insurerName}>
                        <select
                          value={insurerName}
                          onChange={(e) => {
                            setInsurerName(e.target.value);
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.insurerName;
                              return next;
                            });
                          }}
                          className={selectCls(!!fieldErrors.insurerName)}
                        >
                          <option value="">Select insurer</option>
                          {INSURER_OPTIONS.map((insurer) => (
                            <option key={insurer} value={insurer}>
                              {insurer}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>
                )}

                {activeAdvisers.length > 0 && (
                  <Field label="Adviser" required error={fieldErrors.assignedMemberId}>
                    <select
                      required
                      value={assignedMemberId}
                      onChange={(e) => {
                        setAssignedMemberId(e.target.value);
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.assignedMemberId;
                          return next;
                        });
                      }}
                      disabled={advisersLoading}
                      className={selectCls(!!fieldErrors.assignedMemberId)}
                    >
                      <option value="">
                        {advisersLoading ? 'Loading advisers…' : 'Select adviser'}
                      </option>
                      {activeAdvisers.map((adviser) => (
                        <option key={adviser.id} value={adviser.id}>
                          {[adviser.firstName, adviser.lastName].filter(Boolean).join(' ') ||
                            adviser.email}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ink-20 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08 hover:text-ink"
            >
              Cancel
            </button>
            {showDetailsForm && (
              <button
                type="submit"
                disabled={isPending || !isFormValid}
                className="flex items-center gap-2 rounded-md bg-brand-teal-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? 'Creating…' : 'Create client'}
              </button>
            )}
            {showReferredCompanyStep && (
              <button
                type="button"
                onClick={handleContinueFromReferredCompany}
                disabled={!referredToCompany.trim()}
                className="rounded-md bg-brand-teal-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-ink-60 uppercase tracking-wide">
        {label}
        {required && <span className="ml-1 text-red">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red">{error}</p>}
    </div>
  );
}

function InputWithIcon({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-60">
        {icon}
      </span>
      <div className="[&>input]:pl-10 [&>select]:pl-10">{children}</div>
    </div>
  );
}

const inputCls = (hasError: boolean) =>
  [
    'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink outline-none transition',
    'focus:ring-2 focus:ring-brand-teal-500/30',
    hasError
      ? 'border-red focus:border-red'
      : 'border-ink-20 focus:border-brand-teal-500',
  ].join(' ');

const selectCls = (hasError: boolean) =>
  [
    'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink outline-none transition',
    'focus:ring-2 focus:ring-brand-teal-500/30',
    hasError
      ? 'border-red focus:border-red'
      : 'border-ink-20 focus:border-brand-teal-500',
  ].join(' ');
