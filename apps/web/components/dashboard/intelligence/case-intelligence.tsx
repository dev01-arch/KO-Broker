'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  ClipboardCheck,
  Loader2,
  Pencil,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import type { CaseSummary } from '@/lib/api/client';
import { readCaseProperty } from '@/lib/cases/prd16-store';
import { formatApiError, getApiErrorCode, getApiErrorFieldMap } from '@/lib/api/client';
import type {
  IntelligenceCasePreview,
  IntelligenceSnapshot,
  PreviewField,
} from '@/lib/intelligence/types';
import {
  useCopyIntelligenceSnapshotToNotes,
  useCreateIntelligenceSnapshot,
  useIntelligenceCasePreview,
} from '@/hooks/use-intelligence';
import { ComplianceBar } from './compliance-bar';
import { InsightPanel } from './insight-panel';

type CaseStep = 'picker' | 'confirm' | 'form';
type FormMode = 'manual' | 'confirmed';

export type CaseFormValues = {
  postcode: string;
  propertyValue: string;
  deposit: string;
  mortgageAmount: string;
  termYears: string;
  grossIncome: string;
  secondIncome: string;
  monthlyCommitments: string;
};

const EMPTY_FORM: CaseFormValues = {
  postcode: '',
  propertyValue: '',
  deposit: '',
  mortgageAmount: '',
  termYears: '30',
  grossIncome: '',
  secondIncome: '',
  monthlyCommitments: '',
};

type Props = {
  cases: CaseSummary[];
  casesLoading?: boolean;
  initialCaseId?: string | null;
  onClearInitialCaseId?: () => void;
};

function displayPreview(field: PreviewField<string | number>, money = false) {
  if (!field.present || field.value == null || field.value === '') return 'Not on file';
  if (typeof field.value === 'number' && money) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    }).format(field.value);
  }
  if (typeof field.value === 'number' && !money) return String(field.value);
  return String(field.value);
}

function previewToForm(preview: IntelligenceCasePreview): CaseFormValues {
  const num = (f: PreviewField<number>) =>
    f.present && f.value != null ? String(f.value) : '';
  return {
    postcode:
      preview.postcode.present && preview.postcode.value
        ? String(preview.postcode.value)
        : '',
    propertyValue: num(preview.propertyValue),
    deposit: num(preview.deposit),
    mortgageAmount: num(preview.mortgageAmount),
    termYears: num(preview.termYears) || '30',
    grossIncome: num(preview.grossIncome),
    secondIncome: '',
    monthlyCommitments: num(preview.monthlyCommitments),
  };
}

function parseMoney(raw: string): number | undefined {
  const cleaned = raw.replace(/[£,\s]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function formatGbp(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number | null | undefined, digits = 1) {
  if (n == null) return '—';
  return `${n.toFixed(digits)}%`;
}

function Kv({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: 'pos' | 'neg' | 'muted';
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-[#E4E4E4] py-2 text-[13px] last:border-b-0">
      <span className="text-[#5b665f]">{k}</span>
      <span
        className={`font-bold ${
          tone === 'pos'
            ? 'text-brand-teal-700'
            : tone === 'neg'
              ? 'text-[#c23b3b]'
              : tone === 'muted'
                ? 'text-[#8b948d]'
                : 'text-ink'
        }`}
      >
        {v}
      </span>
    </div>
  );
}

function OutPanel({
  title,
  loc,
  children,
}: {
  title: string;
  loc: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#E4E4E4] bg-white p-[18px]">
      <h4 className="text-[13.5px] font-bold text-ink">{title}</h4>
      <p className="mb-3.5 text-xs text-[#8b948d]">{loc}</p>
      {children}
    </div>
  );
}

export function CaseIntelligence({
  cases,
  casesLoading,
  initialCaseId,
  onClearInitialCaseId,
}: Props) {
  const [step, setStep] = useState<CaseStep>('picker');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [form, setForm] = useState<CaseFormValues>(EMPTY_FORM);
  const [mode, setMode] = useState<FormMode>('manual');
  const [modeLabel, setModeLabel] = useState('Manual entry — not linked to a case');
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [linkedCaseId, setLinkedCaseId] = useState<string | null>(null);
  const [showSecondIncome, setShowSecondIncome] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<IntelligenceSnapshot | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const { data: previewRaw, isFetching: previewLoading, error: previewError } =
    useIntelligenceCasePreview(
      step === 'confirm' ? selectedCaseId || null : null,
      step === 'confirm',
    );

  const preview = useMemo(() => {
    if (!previewRaw) return previewRaw;
    if (previewRaw.postcode.present && previewRaw.postcode.value) return previewRaw;
    const stored = readCaseProperty(previewRaw.caseId);
    if (!stored?.postcode) return previewRaw;
    return {
      ...previewRaw,
      postcode: { value: stored.postcode, present: true },
    };
  }, [previewRaw]);

  const createSnapshot = useCreateIntelligenceSnapshot();
  const copyNotes = useCopyIntelligenceSnapshotToNotes();

  const caseOptions = useMemo(
    () =>
      cases.map((c) => ({
        id: c.id,
        label: `${c.client.firstName} ${c.client.lastName} — ${c.referenceNumber}`,
      })),
    [cases],
  );

  const openConfirm = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setStep('confirm');
    setBanner(null);
  }, []);

  const openManual = useCallback((fromConfirm = false) => {
    if (!fromConfirm) {
      setForm(EMPTY_FORM);
      setMode('manual');
      setModeLabel('Manual entry — not linked to a case');
      setLinkedCaseId(null);
      setConfirmedAt(null);
    } else if (preview) {
      setForm(previewToForm(preview));
      setMode('manual');
      setModeLabel('Manual entry — not linked to a case');
      setLinkedCaseId(null);
      setConfirmedAt(null);
    }
    setStep('form');
    setBanner(null);
  }, [preview]);

  const useTheseFigures = useCallback(() => {
    if (!preview) return;
    const hasAny =
      preview.postcode.present ||
      preview.propertyValue.present ||
      preview.mortgageAmount.present;
    if (!hasAny) {
      setBanner('This case has no usable figures yet — enter them manually');
      openManual(true);
      return;
    }
    setForm(previewToForm(preview));
    setMode('confirmed');
    setModeLabel(`Confirmed from ${preview.caseLabel}`);
    setLinkedCaseId(preview.caseId);
    setConfirmedAt(new Date().toISOString());
    setStep('form');
    setBanner(null);
  }, [preview, openManual]);

  // Deep-link: ?caseId= opens confirm when possible
  useEffect(() => {
    if (!initialCaseId) return;
    setSelectedCaseId(initialCaseId);
    setStep('confirm');
    onClearInitialCaseId?.();
  }, [initialCaseId, onClearInitialCaseId]);

  useEffect(() => {
    if (step !== 'confirm') return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStep('picker');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  useEffect(() => {
    if (!previewError) return;
    setBanner('You do not have access to this case.');
    setStep('picker');
  }, [previewError]);

  function updateField(key: keyof CaseFormValues, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((errs) => {
      if (!errs[key]) return errs;
      const next = { ...errs };
      delete next[key];
      return next;
    });
  }

  async function handleGenerate() {
    setBanner(null);
    const errors: Record<string, string> = {};
    const postcode = form.postcode.trim().toUpperCase();
    if (!postcode) errors.postcode = 'Postcode is required';
    const propertyValue = parseMoney(form.propertyValue);
    if (propertyValue == null) errors.propertyValue = 'Enter a property value';
    const mortgageAmount = parseMoney(form.mortgageAmount);
    if (mortgageAmount == null) errors.mortgageAmount = 'Enter a mortgage amount';
    const termYears = Number(form.termYears);
    if (!Number.isFinite(termYears) || termYears <= 0) errors.termYears = 'Enter a term';

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    try {
      const result = await createSnapshot.mutateAsync({
        postcode,
        propertyValue: propertyValue!,
        mortgageAmount: mortgageAmount!,
        termYears,
        deposit: parseMoney(form.deposit),
        grossIncome: parseMoney(form.grossIncome),
        secondIncome: showSecondIncome ? parseMoney(form.secondIncome) : undefined,
        monthlyCommitments: parseMoney(form.monthlyCommitments),
        caseId: mode === 'confirmed' ? linkedCaseId ?? undefined : undefined,
        source: mode === 'confirmed' ? 'CONFIRMED_FROM_CASE' : 'MANUAL',
        confirmedAt: mode === 'confirmed' ? confirmedAt ?? undefined : undefined,
      });
      setSnapshot(result);
    } catch (err) {
      const code = getApiErrorCode(err);
      if (code === 'RATE_DATA_NOT_READY') {
        setBanner('Market data is temporarily unavailable');
      } else if (code === 'POSTCODE_NOT_FOUND') {
        setBanner('We could not look up that postcode…');
      } else {
        const mapped = getApiErrorFieldMap(err);
        if (mapped) setFieldErrors(mapped);
        setBanner(formatApiError(err, { fallback: 'Could not generate snapshot' }));
      }
    }
  }

  const outputs = snapshot?.outputsJson;

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <div className="rounded-[18px] border border-[#E4E4E4] bg-white p-5">
        <h3 className="mb-4 font-heading text-[14.5px] font-bold text-ink">Case inputs</h3>

        {step === 'picker' ? (
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[#5b665f]">
              Load figures from a case
            </label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="mb-2 w-full rounded-[10px] border border-[#E4E4E4] bg-[#fbfbfa] px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand-teal-700 focus:bg-white"
              disabled={casesLoading}
            >
              <option value="">Select a case…</option>
              {caseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="mb-4 flex flex-col items-stretch gap-2">
              <button
                type="button"
                disabled={!selectedCaseId}
                onClick={() => openConfirm(selectedCaseId)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-brand-teal-700 px-3 text-[13.5px] font-bold text-brand-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ClipboardCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Review case figures
              </button>
              <button
                type="button"
                onClick={() => openManual(false)}
                className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-[10px] border border-brand-teal-700 bg-brand-teal-700 px-3 text-[13.5px] font-bold text-white"
              >
                Skip — enter manually
              </button>
            </div>
          </div>
        ) : null}

        {step === 'confirm' ? (
          <div className="mb-4 rounded-[14px] border border-[#a9e3f2] bg-[#E9FCFF] p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-ink">
              <ClipboardCheck className="h-4 w-4 text-brand-teal-700" aria-hidden />
              Confirm figures from this case
            </div>
            {previewLoading || !preview ? (
              <p className="flex items-center gap-2 text-sm text-[#5b665f]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading figures…
              </p>
            ) : (
              <>
                <div className="mb-3.5 grid grid-cols-1 gap-x-3.5">
                  <Kv k="Postcode" v={displayPreview(preview.postcode)} />
                  <Kv k="Property value" v={displayPreview(preview.propertyValue, true)} />
                  <Kv k="Deposit" v={displayPreview(preview.deposit, true)} />
                  <Kv k="Mortgage amount" v={displayPreview(preview.mortgageAmount, true)} />
                  <Kv k="Gross income" v={displayPreview(preview.grossIncome, true)} />
                  <Kv
                    k="Commitments"
                    v={
                      preview.monthlyCommitments.present &&
                      preview.monthlyCommitments.value != null
                        ? `${formatGbp(Number(preview.monthlyCommitments.value))}/mo`
                        : 'Not on file'
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    ref={confirmBtnRef}
                    type="button"
                    onClick={useTheseFigures}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-brand-teal-700 px-3 text-[13.5px] font-bold text-white"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Use these figures
                  </button>
                  <button
                    type="button"
                    onClick={() => openManual(true)}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#E4E4E4] bg-white px-3 text-[13.5px] font-bold text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Edit instead
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {step === 'form' ? (
          <div>
            <p
              className={`mb-4 flex items-center gap-1.5 text-xs ${
                mode === 'confirmed' ? 'text-brand-teal-700' : 'text-[#8b948d]'
              }`}
            >
              {mode === 'confirmed' ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              )}
              {modeLabel}
            </p>

            {(
              [
                ['postcode', 'Postcode'],
                ['propertyValue', 'Property value'],
                ['deposit', 'Deposit'],
                ['mortgageAmount', 'Mortgage amount'],
                ['termYears', 'Term (years)'],
                ['grossIncome', 'Gross annual income'],
                ['monthlyCommitments', 'Monthly commitments'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="mb-3.5">
                <label className="mb-1.5 block text-[12.5px] font-semibold text-[#5b665f]">
                  {label}
                </label>
                <input
                  value={form[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  className="w-full rounded-[10px] border border-[#E4E4E4] bg-[#fbfbfa] px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand-teal-700 focus:bg-white"
                />
                {fieldErrors[key] ? (
                  <p className="mt-1 text-xs text-[#c23b3b]">{fieldErrors[key]}</p>
                ) : null}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setShowSecondIncome((v) => !v)}
              className="mb-2 text-xs font-bold text-brand-teal-700"
            >
              {showSecondIncome ? 'Hide' : 'Add'} second income
            </button>
            {showSecondIncome ? (
              <div className="mb-3.5">
                <label className="mb-1.5 block text-[12.5px] font-semibold text-[#5b665f]">
                  Second income
                </label>
                <input
                  value={form.secondIncome}
                  onChange={(e) => updateField('secondIncome', e.target.value)}
                  className="w-full rounded-[10px] border border-[#E4E4E4] bg-[#fbfbfa] px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand-teal-700 focus:bg-white"
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={createSnapshot.isPending}
              aria-busy={createSnapshot.isPending}
              className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] bg-brand-teal-700 px-4 text-[13.5px] font-bold text-white disabled:opacity-60"
            >
              {createSnapshot.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              )}
              {snapshot ? 'Refresh snapshot' : 'Generate snapshot'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('picker');
                setSelectedCaseId('');
              }}
              className="mt-3 text-xs font-bold text-[#8b948d]"
            >
              ← Back to case picker
            </button>
          </div>
        ) : null}
      </div>

      <div>
        {banner ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-[#f0dfae] bg-[#fff8ea] px-4 py-3 text-sm text-[#7a5b12]"
          >
            {banner}
          </div>
        ) : null}

        {!snapshot ? (
          <div className="rounded-[18px] border border-dashed border-[#E4E4E4] bg-white px-6 py-16 text-center">
            <RefreshCw className="mx-auto mb-3 h-8 w-8 text-[#8b948d]" aria-hidden />
            <p className="font-heading text-base font-bold text-ink">
              Enter figures and generate a snapshot
            </p>
            <p className="mt-1 text-sm text-[#8b948d]">
              Nothing is saved until you do.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <OutPanel
                title="Property"
                loc={snapshot.geographyLabel ?? snapshot.outwardCode}
              >
                {outputs?.property?.noSample ? (
                  <Kv k="Local sample" v="No sold-price sample for this postcode district" tone="muted" />
                ) : (
                  <>
                    <Kv k="Local median price" v={formatGbp(outputs?.property?.localMedian)} />
                    <Kv
                      k="12m price movement"
                      v={
                        outputs?.property?.change12mPct != null
                          ? `${outputs.property.change12mPct > 0 ? '+' : ''}${outputs.property.change12mPct.toFixed(1)}%`
                          : '—'
                      }
                      tone={
                        (outputs?.property?.change12mPct ?? 0) > 0
                          ? 'pos'
                          : (outputs?.property?.change12mPct ?? 0) < 0
                            ? 'neg'
                            : undefined
                      }
                    />
                    <Kv
                      k="12m transactions (local)"
                      v={
                        outputs?.property?.txnCount12m != null
                          ? String(outputs.property.txnCount12m)
                          : '—'
                      }
                    />
                    <Kv
                      k="This property vs median"
                      v={
                        outputs?.property?.vsMedianPct != null
                          ? `${outputs.property.vsMedianPct > 0 ? '+' : ''}${outputs.property.vsMedianPct.toFixed(1)}%`
                          : '—'
                      }
                      tone={
                        Math.abs(outputs?.property?.vsMedianPct ?? 0) > 10
                          ? 'neg'
                          : (outputs?.property?.vsMedianPct ?? 0) >= 0
                            ? 'pos'
                            : undefined
                      }
                    />
                  </>
                )}
              </OutPanel>

              <OutPanel title="Mortgage market" loc="Current benchmarks">
                <Kv
                  k="2yr fixed benchmark"
                  v={formatPct(outputs?.mortgageMarket?.fixed2yrPct, 2)}
                />
                <Kv
                  k="5yr fixed benchmark"
                  v={formatPct(outputs?.mortgageMarket?.fixed5yrPct, 2)}
                />
                <Kv
                  k="75% LTV variable"
                  v={formatPct(outputs?.mortgageMarket?.variable75Pct, 2)}
                />
                <Kv
                  k="Effective new-lending rate"
                  v={formatPct(outputs?.mortgageMarket?.effectiveNewPct, 2)}
                />
              </OutPanel>

              <OutPanel title="Borrower position" loc="From case inputs">
                <Kv k="LTV" v={formatPct(outputs?.borrower?.ltv ?? snapshot.ltv, 0)} />
                <Kv
                  k="Loan-to-income"
                  v={
                    (outputs?.borrower?.lti ?? snapshot.lti) != null
                      ? `${(outputs?.borrower?.lti ?? snapshot.lti)!.toFixed(1)}x`
                      : '—'
                  }
                />
                <Kv
                  k="Debt-to-income"
                  v={outputs?.borrower?.dtiLabel ?? (snapshot.dti != null ? formatPct(snapshot.dti, 1) : '—')}
                  tone={snapshot.dtiBand === 'watch' ? 'neg' : 'pos'}
                />
                <Kv
                  k="Indicative monthly payment"
                  v={formatGbp(outputs?.borrower?.monthlyPayment ?? snapshot.monthlyPayment)}
                />
              </OutPanel>

              <OutPanel title="LTV band context" loc="Relative to BoE benchmark">
                <Kv
                  k="Applicant LTV"
                  v={formatPct(outputs?.ltvBand?.applicantLtv ?? snapshot.ltv, 0)}
                />
                <Kv
                  k="BoE reference band"
                  v={outputs?.ltvBand?.referenceBand ?? '75% LTV'}
                />
                <Kv
                  k="Position"
                  v={outputs?.ltvBand?.position ?? '—'}
                  tone="neg"
                />
                <Kv k="Market range" v={outputs?.ltvBand?.marketRange ?? '—'} />
              </OutPanel>
            </div>

            <InsightPanel
              snapshot={snapshot}
              copyToNotesDisabled={!snapshot.caseId}
              onCopyToNotes={async () => {
                try {
                  await copyNotes.mutateAsync(snapshot.id);
                  setBanner('Insight appended to case notes');
                } catch (err) {
                  setBanner(formatApiError(err, { fallback: 'Could not copy to case notes' }));
                }
              }}
            />
          </>
        )}

        <ComplianceBar />
      </div>
    </div>
  );
}
