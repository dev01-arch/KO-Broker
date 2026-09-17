'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Loader2, Upload } from 'lucide-react';
import {
  CLIENT_IMPORT_GUIDED_MAX_ROWS,
  type ClientImportField,
  type ImportClientsResult,
} from '@ko/types';
import {
  ApiError,
  clientsApi,
  formatApiError,
  requireAuthToken,
  type ClientSummary,
} from '@/lib/api/client';
import {
  autoMapImportHeaders,
  buildFailedRowsCsv,
  CLIENT_IMPORT_FIELD_LABELS,
  CLIENT_IMPORT_FIELDS,
  downloadTextFile,
  ignoredImportHeaders,
  mapParsedRows,
  mappingReady,
  parseClientImportFile,
  sampleColumnValues,
  type ParsedImportMatrix,
  type PreviewImportRow,
} from '@/lib/clients/import-parse';

type WizardStep = 'upload' | 'map' | 'preview' | 'result';

const EMPTY_MAPPING = Object.fromEntries(
  CLIENT_IMPORT_FIELDS.map((field) => [field, null]),
) as Record<ClientImportField, string | null>;

function toClientSummary(row: PreviewImportRow, result: ImportClientsResult['results'][number]): ClientSummary {
  return {
    id: result.clientId!,
    referenceNumber: result.referenceNumber ?? '',
    clientType: row.payload.clientType === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL',
    companyName: row.payload.companyName,
    firstName: row.payload.firstName ?? row.payload.companyName ?? '',
    lastName: row.payload.lastName ?? (row.payload.clientType === 'COMPANY' ? '—' : ''),
    email: row.payload.email,
    employmentStatus:
      row.payload.employmentStatus === 'SELF_EMPLOYED' ||
      row.payload.employmentStatus === 'CONTRACTOR' ||
      row.payload.employmentStatus === 'RETIRED' ||
      row.payload.employmentStatus === 'UNEMPLOYED'
        ? row.payload.employmentStatus
        : 'EMPLOYED',
    annualIncome: typeof row.payload.annualIncome === 'number' ? row.payload.annualIncome : undefined,
    isReferred: false,
    insurerName: row.payload.insurerName,
    status: 'PROSPECT',
    isVulnerable: false,
    assignedMember: null,
    _count: { cases: 0, messages: 0 },
  };
}

export function ImportClientsModal({
  open,
  existingEmails,
  onClose,
  onImported,
}: {
  open: boolean;
  existingEmails: string[];
  onClose: () => void;
  onImported: (clients: ClientSummary[]) => void;
}) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>('upload');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [parsed, setParsed] = useState<ParsedImportMatrix | null>(null);
  const [mapping, setMapping] = useState<Record<ClientImportField, string | null>>(EMPTY_MAPPING);
  const [sendWelcomeEmails, setSendWelcomeEmails] = useState(false);
  const [result, setResult] = useState<ImportClientsResult | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewImportRow[]>([]);

  function reset() {
    setStep('upload');
    setError(null);
    setBusy(false);
    setCommitting(false);
    setParsed(null);
    setMapping(EMPTY_MAPPING);
    setSendWelcomeEmails(false);
    setResult(null);
    setPreviewRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when closed/opened
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (committing) return;
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, committing, onClose]);

  const ignored = useMemo(
    () => (parsed ? ignoredImportHeaders(parsed.headers, mapping) : []),
    [parsed, mapping],
  );
  const mapGate = mappingReady(mapping);
  const previewCounts = useMemo(() => {
    const created = previewRows.filter((row) => row.status === 'create').length;
    const skipped = previewRows.filter((row) => row.status === 'skip').length;
    const failed = previewRows.filter((row) => row.status === 'fail').length;
    return { created, skipped, failed };
  }, [previewRows]);

  const confirmEnabled =
    !committing &&
    previewCounts.failed !== previewRows.length &&
    previewRows.length > 0 &&
    !(parsed?.overGuidedMax);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const parsedFile = await parseClientImportFile(file);
      if ('error' in parsedFile) {
        setError(parsedFile.error);
        return;
      }
      setParsed(parsedFile);
      setMapping(autoMapImportHeaders(parsedFile.headers));
      setStep('map');
    } finally {
      setBusy(false);
    }
  }

  function goPreview() {
    if (!parsed || !mapGate.ready) return;
    const rows = mapParsedRows({
      headers: parsed.headers,
      rows: parsed.rows,
      mapping,
      existingEmails,
    });
    setPreviewRows(rows);
    setError(
      parsed.overGuidedMax
        ? `Split the file (max ${CLIENT_IMPORT_GUIDED_MAX_ROWS} per import).`
        : null,
    );
    setStep('preview');
  }

  async function handleConfirm() {
    if (!parsed || !confirmEnabled) return;
    setCommitting(true);
    setError(null);
    try {
      const token = await requireAuthToken(getToken);
      const response = await clientsApi.import(token, {
        fileName: parsed.fileName,
        sendWelcomeEmails,
        duplicateEmail: 'skip',
        rows: previewRows.map((row) => row.payload),
      });
      setResult(response.data);
      const createdClients = response.data.results
        .filter((row) => row.status === 'CREATED' && row.clientId)
        .map((row) => {
          const preview = previewRows.find((item) => item.rowNumber === row.rowNumber);
          return preview ? toClientSummary(preview, row) : null;
        })
        .filter((client): client is ClientSummary => Boolean(client));
      onImported(createdClients);
      setStep('result');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'FORBIDDEN') {
        setError('Only firm admins can import clients.');
      } else if (err instanceof ApiError && err.code === 'IMPORT_TOO_LARGE') {
        setError('Split the file (max 1,000 rows per import).');
      } else {
        setError(formatApiError(err, { fallback: 'Import failed. Your mapping is kept — you can retry.' }));
      }
    } finally {
      setCommitting(false);
    }
  }

  function downloadFailed() {
    const source =
      result && previewRows.length
        ? previewRows.map((row) => {
            const server = result.results.find((item) => item.rowNumber === row.rowNumber);
            if (server?.status === 'FAILED') {
              return {
                ...row,
                status: 'fail' as const,
                message: server.fields ? Object.values(server.fields)[0] : row.message,
              };
            }
            return row;
          })
        : previewRows;
    downloadTextFile('kompass-clients-import-errors.csv', buildFailedRowsCsv(source));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-clients-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 id="import-clients-title" className="font-display text-lg font-bold text-ink">
              Import clients
            </h2>
            <p className="mt-0.5 text-xs text-[#71717a]">
              {step === 'upload' && 'CSV or Excel — clients only. Nobody is emailed unless you choose that later.'}
              {step === 'map' && 'Match your columns to KO fields. Extra columns are ignored.'}
              {step === 'preview' && 'Check who will be created, skipped, or rejected before confirming.'}
              {step === 'result' && 'Import finished. Stay on the Clients tab to review the new records.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={committing}
            className="min-h-11 min-w-11 text-xl leading-none text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close import"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleFile(event.dataTransfer.files?.[0]);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-10 transition-colors hover:border-brand-teal-400"
              >
                {busy ? (
                  <Loader2 className="h-8 w-8 animate-spin text-brand-teal-500" />
                ) : (
                  <Upload className="h-8 w-8 text-gray-400" />
                )}
                <p className="text-sm font-medium text-ink">Drop a CSV or Excel file, or click to browse</p>
                <p className="text-xs text-[#71717a]">.csv, .xlsx required · .xls best-effort · max 500 rows</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
              </div>
            </div>
          )}

          {step === 'map' && parsed && (
            <div className="space-y-4">
              <p className="text-sm text-ink">
                {parsed.fileName} · {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'}
              </p>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fafafa] text-xs font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    <tr>
                      <th className="px-3 py-2">KO field</th>
                      <th className="px-3 py-2">Your column</th>
                      <th className="px-3 py-2">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CLIENT_IMPORT_FIELDS.map((field) => {
                      const header = mapping[field];
                      const index = header ? parsed.headers.indexOf(header) : -1;
                      const samples = index >= 0 ? sampleColumnValues(parsed.rows, index) : [];
                      return (
                        <tr key={field} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-ink">
                            {CLIENT_IMPORT_FIELD_LABELS[field]}
                            {field === 'email' ? <span className="text-brand-teal-500"> *</span> : null}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={header ?? ''}
                              onChange={(event) =>
                                setMapping((current) => ({
                                  ...current,
                                  [field]: event.target.value || null,
                                }))
                              }
                              className="min-h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                            >
                              <option value="">Not in file</option>
                              {parsed.headers.map((item) => (
                                <option key={`${field}-${item}`} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs text-[#71717a]">
                            {samples.length ? samples.join(' · ') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {ignored.length > 0 && (
                <p className="text-xs text-[#71717a]">
                  Ignored: {ignored.join(', ')}
                </p>
              )}
              {!mapGate.ready && <p className="text-xs text-[#b45309]">{mapGate.reason}</p>}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-ink">
                {previewCounts.created} will be created · {previewCounts.skipped} skipped · {previewCounts.failed} need a fix
              </p>
              <div className="max-h-64 overflow-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[#fafafa] text-xs font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-[#71717a]">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-ink">{row.name}</div>
                          <div className="text-xs text-[#71717a]">{row.email || '—'}</div>
                        </td>
                        <td className="px-3 py-2">
                          {row.status === 'create' && (
                            <span className="rounded-full bg-brand-teal-50 px-2 py-0.5 text-xs font-medium text-brand-teal-700">
                              Will create
                            </span>
                          )}
                          {row.status === 'skip' && (
                            <span className="rounded-full bg-[#E9FCFF] px-2 py-0.5 text-xs font-medium text-[#0891b2]">
                              Duplicate
                            </span>
                          )}
                          {row.status === 'fail' && (
                            <span className="text-xs font-medium text-[#be123c]">
                              Error · {row.message}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-gray-100 bg-[#fafafa] p-3 text-sm text-ink">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={sendWelcomeEmails}
                  onChange={(event) => setSendWelcomeEmails(event.target.checked)}
                />
                <span>
                  <span className="font-medium">Email these clients a welcome message</span>
                  <span className="mt-1 block text-xs text-[#71717a]">
                    Leave off when migrating. Existing clients should not get a new-account email.
                  </span>
                </span>
              </label>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-ink">
                {result.created} created · {result.skipped} skipped · {result.failed} failed
              </p>
              {result.failed > 0 && (
                <button
                  type="button"
                  onClick={downloadFailed}
                  className="min-h-11 text-sm font-medium text-brand-teal-500 hover:text-brand-teal-700"
                >
                  Download failed rows as CSV
                </button>
              )}
              {result.created === 0 && result.skipped > 0 && result.failed === 0 && (
                <p className="text-sm text-[#71717a]">Those emails are already in this firm. Nothing was added.</p>
              )}
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 px-6 py-4">
          {step !== 'result' && (
            <button
              type="button"
              onClick={onClose}
              disabled={committing}
              className="min-h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {step === 'map' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="min-h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!mapGate.ready}
                onClick={goPreview}
                className="min-h-11 rounded-lg bg-brand-teal-500 px-4 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:opacity-50"
              >
                Preview
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button
                type="button"
                disabled={committing}
                onClick={() => setStep('map')}
                className="min-h-11 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!confirmEnabled}
                aria-busy={committing}
                onClick={() => void handleConfirm()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-teal-500 px-4 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:opacity-50"
              >
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm import
              </button>
            </>
          )}
          {step === 'result' && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg bg-brand-teal-500 px-4 text-sm font-medium text-white hover:bg-brand-teal-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
