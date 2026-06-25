'use client';

import { use, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Briefcase,
  ChevronLeft,
  DollarSign,
  Edit2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Shield,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useClient, useUpdateClient } from '@/hooks/use-clients';
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/use-documents';
import { ApiErrorState } from '@/components/dashboard/api-error-state';
import {
  formatClientEmployment,
  formatClientInitials,
  formatClientName,
} from '@/lib/api/client-display';
import { formatApiError } from '@/lib/api/client';
import type { DocumentRecord, DocumentType } from '@/lib/api/client';
import type { UploadFileInput } from '@/hooks/use-documents';

const CASE_STAGE_STYLES: Record<string, string> = {
  ENQUIRY: 'bg-stage-enquiry-bg text-stage-enquiry-text border-stage-enquiry-border',
  FACT_FIND: 'bg-stage-factfind-bg text-stage-factfind-text border-stage-factfind-border',
  RESEARCH: 'bg-stage-research-bg text-stage-research-text border-stage-research-border',
  DIP: 'bg-stage-dip-bg text-stage-dip-text border-stage-dip-border',
  OFFER: 'bg-stage-offer-bg text-stage-offer-text border-stage-offer-border',
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  ID: 'Identity',
  INCOME: 'Income',
  FINANCIAL: 'Financial',
  LENDER: 'Lender',
  COMPLIANCE: 'Compliance',
  OTHER: 'Other',
};

const DOC_TYPE_COLORS: Record<DocumentType, string> = {
  ID: 'bg-blue/10 text-blue',
  INCOME: 'bg-green/10 text-green',
  FINANCIAL: 'bg-purple/10 text-purple',
  LENDER: 'bg-brand-teal-50 text-brand-teal-700',
  COMPLIANCE: 'bg-amber/10 text-amber',
  OTHER: 'bg-ink-08 text-ink-60',
};

function formatBytes(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Upload Document Modal ────────────────────────────────────────────────────

interface UploadModalProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadDocumentModal({ clientId, clientName, onClose, onSuccess }: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('ID');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: uploadDocument, isPending } = useUploadDocument();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setError(null);
    try {
      await uploadDocument({
        file: selectedFile,
        documentType: docType,
        clientId,
      } satisfies UploadFileInput);

      onSuccess();
      onClose();
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Upload failed. Please try again.' }));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-20 px-6 py-4">
          <div>
            <h2 className="font-heading text-sm font-bold text-ink">Upload Document</h2>
            <p className="text-xs text-ink-60 mt-0.5">for {clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-60 hover:text-ink text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            {/* File picker */}
            <div>
              <label className="block text-xs font-medium text-ink-60 mb-1.5">
                File <span className="text-red-500">*</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
                  selectedFile
                    ? 'border-brand-teal-400 bg-brand-teal-50'
                    : 'border-ink-20 bg-ink-08/40 hover:border-brand-teal-300 hover:bg-brand-teal-50/30'
                }`}
              >
                {selectedFile ? (
                  <>
                    <FileText className="h-8 w-8 text-brand-teal-500" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-ink truncate max-w-[260px]">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-ink-60 mt-0.5">
                        {formatBytes(selectedFile.size)} ·{' '}
                        {selectedFile.type || 'Unknown type'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="text-xs text-ink-60 hover:text-red-500 underline"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-ink-60" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-ink">Click to choose a file</p>
                      <p className="text-xs text-ink-60">PDF, images, Word, Excel — up to 50 MB</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.heic"
                />
              </div>
            </div>

            {/* Document type */}
            <div>
              <label className="block text-xs font-medium text-ink-60 mb-1.5">
                Document type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full rounded-lg border border-ink-20 px-3 py-2 text-sm text-ink focus:border-brand-teal-500 focus:outline-none"
              >
                {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="flex items-center gap-1.5 rounded-lg bg-red/10 px-3 py-2 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-ink-20 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-ink-20 px-4 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || isPending}
              className="flex items-center gap-2 rounded-lg bg-brand-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-teal-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Document row ─────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  onDelete,
}: {
  doc: DocumentRecord;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { mutateAsync: deleteDocument, isPending: isDeleting } = useDeleteDocument();

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    await deleteDocument(doc.id);
    onDelete(doc.id);
    setConfirming(false);
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-ink-20 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-08">
        <FileText className="h-4 w-4 text-ink-60" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{doc.name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${DOC_TYPE_COLORS[doc.documentType]}`}
          >
            {DOC_TYPE_LABELS[doc.documentType]}
          </span>
          {doc.sizeBytes && (
            <span className="text-[10px] text-ink-60">{formatBytes(doc.sizeBytes)}</span>
          )}
          <span className="text-[10px] text-ink-60">{formatDate(doc.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <a
          href={doc.storageUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View document"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-60 hover:bg-ink-08 hover:text-ink transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          title={confirming ? 'Click again to confirm delete' : 'Delete document'}
          onClick={handleDelete}
          disabled={isDeleting}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            confirming
              ? 'bg-red/10 text-red-600'
              : 'text-ink-60 hover:bg-red/10 hover:text-red-600'
          } disabled:opacity-50`}
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, isError, error, refetch } = useClient(id);
  const { mutateAsync: updateClient, isPending: isUpdating } = useUpdateClient(id);
  const { data: docsData, isLoading: docsLoading, refetch: refetchDocs } = useDocuments(
    { clientId: id, perPage: 50 },
  );
  const [editingVulnerable, setEditingVulnerable] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const client = data?.data;
  const documents = docsData?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-ink-60">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading client…</span>
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <ApiErrorState
          error={error}
          fallback="Client not found or failed to load."
          onRetry={() => void refetch()}
          className="min-h-0 py-8"
        />
        <Link href="/dashboard/clients" className="text-sm text-brand-teal-700 hover:underline">
          ← Back to clients
        </Link>
      </div>
    );
  }

  async function toggleVulnerable() {
    if (!client) return;
    setEditingVulnerable(true);
    try {
      await updateClient({ isVulnerable: !client.isVulnerable });
    } finally {
      setEditingVulnerable(false);
    }
  }

  return (
    <>
      {showUpload && (
        <UploadDocumentModal
          clientId={id}
          clientName={formatClientName(client)}
          onClose={() => setShowUpload(false)}
          onSuccess={() => refetchDocs()}
        />
      )}

      <div>
        {/* Page header */}
        <div className="flex h-[52px] items-center gap-3 border-b border-ink-20 bg-white px-7">
          <Link
            href="/dashboard/clients"
            className="flex items-center gap-1 text-sm text-ink-60 hover:text-ink transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Clients
          </Link>
          <span className="text-ink-20">/</span>
          <h1 className="font-heading text-[15px] font-bold text-ink">
            {formatClientName(client)}
          </h1>
          <span className="font-mono text-xs text-ink-60">{client.referenceNumber}</span>
        </div>

        <div className="p-7 grid grid-cols-3 gap-6">
          {/* Left column — profile */}
          <div className="col-span-2 space-y-5">
            {/* Identity card */}
            <section className="rounded-xl border border-ink-20 bg-white p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal-50 text-xl font-bold text-brand-teal-700">
                    {formatClientInitials(client)}
                  </div>
                  <div>
                    <h2 className="font-heading text-lg font-bold text-ink">
                      {client.clientType === 'COMPANY'
                        ? formatClientName(client)
                        : `${client.title ? `${client.title} ` : ''}${client.firstName} ${client.lastName}`}
                    </h2>
                    <p className="text-sm text-ink-60">
                      {client.clientType === 'COMPANY' ? 'Limited company' : client.referenceNumber}
                    </p>
                    {client.clientType === 'COMPANY' && (
                      <p className="text-xs text-ink-60 font-mono">{client.referenceNumber}</p>
                    )}
                  </div>
                </div>
                {client.isVulnerable && (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Vulnerable customer
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <DetailItem icon={<Mail className="h-4 w-4" />} label="Email">
                  <a href={`mailto:${client.email}`} className="text-brand-teal-700 hover:underline">
                    {client.email}
                  </a>
                </DetailItem>
                <DetailItem icon={<Phone className="h-4 w-4" />} label="Phone">
                  {client.phone ? (
                    <a href={`tel:${client.phone}`} className="text-ink">
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-ink-60">—</span>
                  )}
                </DetailItem>
                <DetailItem icon={<Briefcase className="h-4 w-4" />} label="Employment">
                  {formatClientEmployment(client)}
                </DetailItem>
                <DetailItem
                  icon={<DollarSign className="h-4 w-4" />}
                  label={client.clientType === 'COMPANY' ? 'Annual turnover / income' : 'Annual income'}
                >
                  {client.annualIncome != null
                    ? `£${client.annualIncome.toLocaleString('en-GB')}`
                    : '—'}
                </DetailItem>
                {client.clientType === 'COMPANY' && client.companyNumber && (
                  <DetailItem icon={<Briefcase className="h-4 w-4" />} label="Company number">
                    {client.companyNumber}
                  </DetailItem>
                )}
                {client.dateOfBirth && client.clientType !== 'COMPANY' && (
                  <DetailItem icon={<User className="h-4 w-4" />} label="Date of birth">
                    {new Date(client.dateOfBirth).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </DetailItem>
                )}
              </dl>
            </section>

            {/* Cases */}
            <section className="rounded-xl border border-ink-20 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-sm font-bold text-ink">
                  Cases
                  <span className="ml-2 rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
                    {client.cases.length}
                  </span>
                </h3>
                <button className="text-sm font-medium text-brand-teal-700 hover:underline">
                  + New case
                </button>
              </div>

              {client.cases.length === 0 ? (
                <p className="text-sm text-ink-60">No cases yet.</p>
              ) : (
                <div className="divide-y divide-ink-20">
                  {client.cases.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-sm text-ink">{c.referenceNumber}</p>
                        <p className="text-xs text-ink-60 capitalize">{c.type.toLowerCase()}</p>
                      </div>
                      <span
                        className={[
                          'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          CASE_STAGE_STYLES[c.stage] ?? 'bg-ink-08 text-ink-60 border-ink-20',
                        ].join(' ')}
                      >
                        {c.stage.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Documents */}
            <section className="rounded-xl border border-ink-20 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-sm font-bold text-ink flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-teal-500" />
                  Documents
                  <span className="rounded-full bg-ink-08 px-2 py-0.5 text-xs font-medium text-ink-60">
                    {documents.length}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-teal-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-teal-600 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </button>
              </div>

              {docsLoading ? (
                <div className="flex items-center gap-2 py-4 text-ink-60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading documents…</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <FileText className="h-9 w-9 text-ink-20" />
                  <p className="text-sm text-ink-60">No documents uploaded yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="text-sm text-brand-teal-600 hover:underline"
                  >
                    Upload the first document →
                  </button>
                </div>
              ) : (
                <div>
                  {documents.map((doc) => (
                    <DocumentRow key={doc.id} doc={doc} onDelete={() => refetchDocs()} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right column — actions & meta */}
          <div className="space-y-5">
            {/* Counts */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<MessageSquare className="h-5 w-5 text-blue" />}
                value={client._count.messages}
                label="Messages"
              />
              <StatCard
                icon={<FileText className="h-5 w-5 text-brand-teal-500" />}
                value={documents.length > 0 ? documents.length : client._count.documents}
                label="Documents"
              />
            </div>

            {/* Vulnerability */}
            <section className="rounded-xl border border-ink-20 bg-white p-5">
              <h3 className="font-heading text-sm font-bold text-ink mb-3">Vulnerability</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-60">Vulnerable customer</span>
                <button
                  onClick={toggleVulnerable}
                  disabled={isUpdating || editingVulnerable}
                  className={[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
                    client.isVulnerable ? 'bg-amber' : 'bg-ink-20',
                    isUpdating || editingVulnerable ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                  role="switch"
                  aria-checked={client.isVulnerable}
                >
                  <span
                    className={[
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      client.isVulnerable ? 'translate-x-6' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>
              </div>
              {client.vulnerabilityNotes && (
                <p className="mt-3 rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">
                  {client.vulnerabilityNotes}
                </p>
              )}
            </section>

            {/* Portal access */}
            <section className="rounded-xl border border-ink-20 bg-white p-5">
              <h3 className="font-heading text-sm font-bold text-ink mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-brand-teal-500" />
                Client portal
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-60">Portal access</span>
                <span
                  className={[
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    client.portalEnabled
                      ? 'bg-brand-teal-50 text-brand-teal-700'
                      : 'bg-ink-08 text-ink-60',
                  ].join(' ')}
                >
                  {client.portalEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </section>

            {/* Quick actions */}
            <section className="rounded-xl border border-ink-20 bg-white p-5">
              <h3 className="font-heading text-sm font-bold text-ink mb-3">Actions</h3>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-2 rounded-lg border border-ink-20 px-3 py-2.5 text-sm text-ink-60 hover:bg-ink-08 hover:text-ink transition-colors">
                  <Edit2 className="h-4 w-4" />
                  Edit client details
                </button>
                <button className="w-full flex items-center gap-2 rounded-lg border border-ink-20 px-3 py-2.5 text-sm text-ink-60 hover:bg-ink-08 hover:text-ink transition-colors">
                  <MessageSquare className="h-4 w-4" />
                  Send message
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="w-full flex items-center gap-2 rounded-lg border border-brand-teal-300 bg-brand-teal-50 px-3 py-2.5 text-sm font-medium text-brand-teal-700 hover:bg-brand-teal-100 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Upload document
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-ink-60">{icon}</span>
      <div>
        <dt className="text-xs text-ink-60 mb-0.5">{label}</dt>
        <dd className="text-sm text-ink">{children}</dd>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-ink-20 bg-white p-4 flex flex-col gap-1">
      {icon}
      <span className="text-2xl font-bold font-heading text-ink">{value}</span>
      <span className="text-xs text-ink-60">{label}</span>
    </div>
  );
}
