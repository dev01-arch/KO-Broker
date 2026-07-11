'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import { useAiReports, useGenerateReport, useApproveReport, useRegenerateSection } from '@/hooks/use-ai-reports';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import { PlanGate } from '@/components/dashboard/plan-gate';
import { usePlanFeature } from '@/hooks/use-org';
import { useHealth } from '@/hooks/use-system';
import { useCases } from '@/hooks/use-cases';
import type { AiReport, ReportTemplate, ReportStatus } from '@/lib/api/client';
import { formatApiError, normalizeAiReportSections } from '@/lib/api/client';

const TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  BTL: 'Buy to Let',
  FTB: 'First Time Buyer',
  REMORTGAGE: 'Remortgage',
  HOME_MOVER: 'Home Mover',
  PRODUCT_TRANSFER: 'Product Transfer',
  DIVORCE: 'Divorce / Separation',
  SELF_EMPLOYED: 'Self Employed',
  VULNERABLE_OVERLAY: 'Vulnerable Customer Overlay',
};

const STATUS_STYLES: Record<ReportStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-ink-08 text-ink-60 border-ink-20' },
  ADVISER_REVIEW: { label: 'Adviser Review', className: 'bg-amber/10 text-amber border-amber/20' },
  APPROVED: { label: 'Approved', className: 'bg-brand-teal-50 text-brand-teal-700 border-brand-teal-200' },
  FINALISED: { label: 'Finalised', className: 'bg-green/10 text-green border-green/20' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ReportCard({ report }: { report: AiReport }) {
  const [expanded, setExpanded] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const { mutateAsync: approve, isPending: isApproving } = useApproveReport();
  const { mutateAsync: regenerateSection } = useRegenerateSection();
  const statusInfo = STATUS_STYLES[report.status];
  const sections = normalizeAiReportSections(report.sections);
  const canEdit = report.status === 'DRAFT' || report.status === 'ADVISER_REVIEW' || report.status === 'APPROVED';

  return (
    <div className="rounded-xl border border-ink-20 bg-white overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-ink-08 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal-50">
            <Bot className="h-5 w-5 text-brand-teal-600" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {TEMPLATE_LABELS[report.templateType] ?? report.templateType}
            </p>
            <p className="text-xs text-ink-60 font-mono">{report.caseId.slice(0, 8)}…</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-ink-60">{formatDate(report.updatedAt)}</span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
          >
            {statusInfo.label}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-ink-60 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-ink-20 px-5 py-4 space-y-4">
          {sections.length > 0 ? (
            sections.map((section) => (
              <div key={section.id} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink-60 mb-1">
                      {section.title}
                    </h4>
                    {section.complianceFlag === 'REVIEW_REQUIRED' && (
                      <p className="mb-1 flex items-center gap-1 text-[11px] text-amber">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        {section.flagReason || 'Review required'}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={regeneratingId === section.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setRegenError(null);
                        setRegeneratingId(section.id);
                        try {
                          await regenerateSection({
                            reportId: report.id,
                            sectionId: section.id,
                          });
                        } catch (err) {
                          setRegenError(
                            formatApiError(err, { fallback: 'Could not regenerate section.' }),
                          );
                        } finally {
                          setRegeneratingId(null);
                        }
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-ink-20 px-2 py-1 text-xs font-medium text-ink-60 hover:bg-ink-08 disabled:opacity-50"
                    >
                      {regeneratingId === section.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Regenerate
                    </button>
                  )}
                </div>
                <p className="text-sm text-ink whitespace-pre-wrap">{section.content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-60">No sections generated yet.</p>
          )}

          {regenError && (
            <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{regenError}</p>
          )}

          {(report.status === 'DRAFT' || report.status === 'ADVISER_REVIEW') && (
            <div className="flex flex-col gap-2 pt-2">
              {approveError && (
                <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{approveError}</p>
              )}
              <button
                type="button"
                disabled={isApproving}
                onClick={async () => {
                  setApproveError(null);
                  try {
                    await approve(report.id);
                  } catch (err) {
                    setApproveError(formatApiError(err, { fallback: 'Could not approve report.' }));
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-brand-teal-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-teal-600 disabled:opacity-50"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4" />
                )}
                Approve & Finalise
              </button>
            </div>
          )}

          {(report.status === 'APPROVED' || report.status === 'FINALISED') && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-teal-50 px-3 py-2 text-sm text-brand-teal-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Report {report.status === 'FINALISED' ? 'finalised' : 'approved'}.
              {report.approvedBy && <span className="text-brand-teal-600/70"> by {report.approvedBy.slice(0, 8)}…</span>}
              {report.pdfUrl && (
                <a
                  href={report.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs font-medium underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View PDF
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GenerateModal({
  cases,
  onClose,
  onGenerate,
  isPending,
  error,
}: {
  cases: { id: string; referenceNumber: string; type: string }[];
  onClose: () => void;
  onGenerate: (caseId: string, template: ReportTemplate) => void | Promise<void>;
  isPending: boolean;
  error?: string | null;
}) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '');
  const [template, setTemplate] = useState<ReportTemplate>('FTB');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-ink-20 px-6 py-4">
          <h2 className="font-heading text-sm font-bold text-ink">Generate AI Report</h2>
          <button type="button" onClick={onClose} className="text-ink-60 hover:text-ink text-xl leading-none">
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-ink-60 mb-1.5">Case</label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full rounded-lg border border-ink-20 px-3 py-2 text-sm text-ink focus:border-brand-teal-500 focus:outline-none"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.referenceNumber} — {c.type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-60 mb-1.5">Report Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as ReportTemplate)}
              className="w-full rounded-lg border border-ink-20 px-3 py-2 text-sm text-ink focus:border-brand-teal-500 focus:outline-none"
            >
              {(Object.keys(TEMPLATE_LABELS) as ReportTemplate[]).map((t) => (
                <option key={t} value={t}>
                  {TEMPLATE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-ink-20 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-ink-20 px-4 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08">
            Cancel
          </button>
          <button
            type="button"
            disabled={!caseId || isPending}
            onClick={() => onGenerate(caseId, template)}
            className="flex items-center gap-2 rounded-lg bg-brand-teal-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand-teal-600"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

const LIST_QUERY = { page: 1, perPage: 50 } as const;

export default function AIReportsPage() {
  const hasAiReports = usePlanFeature('ai_reports');
  const { data: health } = useHealth({ enabled: hasAiReports });
  const aiAvailable = health?.services?.ai !== false;
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { data: reportsData, isLoading, isError, error, refetch } = useAiReports(LIST_QUERY, {
    enabled: hasAiReports,
  });
  const { data: casesData } = useCases({ page: 1, perPage: 100 });
  const { mutateAsync: generateReport, isPending: isGenerating } = useGenerateReport();

  const reports = reportsData?.data ?? [];
  const cases = casesData?.data ?? [];
  const meta = reportsData?.meta;

  async function handleGenerate(caseId: string, templateType: ReportTemplate) {
    setGenerateError(null);
    try {
      await generateReport({ caseId, templateType });
      setShowGenerate(false);
    } catch (err) {
      setGenerateError(formatApiError(err, { fallback: 'Could not generate report.' }));
    }
  }

  if (!hasAiReports) {
    return (
      <>
        <div className="flex h-[52px] items-center border-b border-ink-20 bg-white px-7">
          <h1 className="font-heading text-[15px] font-bold text-ink">AI Suitability Reports</h1>
        </div>
        <PlanGate
          feature="ai_reports"
          title="AI Reports are a Professional feature"
          description="Upgrade to generate AI-powered suitability reports."
        />
      </>
    );
  }

  return (
    <>
      {showGenerate && (
        <GenerateModal
          cases={cases.map((c) => ({ id: c.id, referenceNumber: c.referenceNumber, type: c.type }))}
          onClose={() => {
            setShowGenerate(false);
            setGenerateError(null);
          }}
          onGenerate={handleGenerate}
          isPending={isGenerating}
          error={generateError}
        />
      )}

      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-brand-teal-500" />
          <h1 className="font-heading text-[15px] font-bold text-ink">AI Suitability Reports</h1>
          {meta && (
            <span className="rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
              {meta.total}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal-700/25 bg-brand-teal-700/10 px-3 py-1 text-[11px] font-semibold text-brand-teal-700">
            <Bot className="h-3 w-3" /> AI Reports
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowGenerate(true)}
          disabled={cases.length === 0 || !aiAvailable}
          title={!aiAvailable ? 'AI service is currently unavailable' : undefined}
          className="flex items-center gap-1.5 rounded-md bg-brand-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-teal-600 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          Generate report
        </button>
      </div>

      <div className="p-7">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-ink-60">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading reports…</span>
          </div>
        ) : isError ? (
          <ApiErrorState
            error={error}
            fallback="Failed to load reports."
            onRetry={() => void refetch()}
          />
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="h-12 w-12 text-ink-20" />
            <p className="text-sm font-medium text-ink-60">No AI reports generated yet.</p>
            {cases.length > 0 && (
              <button
                type="button"
                onClick={() => setShowGenerate(true)}
                className="flex items-center gap-1.5 text-sm text-brand-teal-600 hover:underline"
              >
                <Sparkles className="h-4 w-4" />
                Generate your first report
              </button>
            )}
            {cases.length === 0 && (
              <p className="text-xs text-ink-60">Create a case first to generate a report.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
