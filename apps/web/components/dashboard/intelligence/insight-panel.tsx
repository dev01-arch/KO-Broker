'use client';

import { useState } from 'react';
import { Check, Clock, Copy, Lightbulb } from 'lucide-react';
import type { IntelligenceSnapshot } from '@/lib/intelligence/types';

type Props = {
  snapshot: IntelligenceSnapshot;
  onCopyToNotes?: () => Promise<void> | void;
  copyToNotesDisabled?: boolean;
  copyToNotesTooltip?: string;
};

export function InsightPanel({
  snapshot,
  onCopyToNotes,
  copyToNotesDisabled = false,
  copyToNotesTooltip = 'Link a case to copy notes',
}: Props) {
  const [copied, setCopied] = useState(false);
  const [notesBusy, setNotesBusy] = useState(false);

  async function copyText() {
    const block = [
      snapshot.insightText,
      snapshot.watchText ? `Watch: ${snapshot.watchText}` : null,
      snapshot.sourcesJson?.length
        ? `Sources: ${snapshot.sourcesJson.map((s) => s.label).join(', ')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function handleCopyNotes() {
    if (!onCopyToNotes || copyToNotesDisabled) return;
    setNotesBusy(true);
    try {
      await onCopyToNotes();
    } finally {
      setNotesBusy(false);
    }
  }

  const generated = new Date(snapshot.generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="rounded-2xl border border-[#E4E4E4] bg-gradient-to-br from-brand-teal-50 to-white p-5">
      <div className="mb-2.5 flex items-center gap-2">
        <Lightbulb className="h-[18px] w-[18px] text-brand-teal-700" aria-hidden />
        <h4 className="font-heading text-sm font-bold text-ink">Broker insight</h4>
      </div>
      <p className="mb-3.5 text-sm leading-relaxed text-ink">{snapshot.insightText}</p>
      {snapshot.watchText ? (
        <div className="mb-3.5 rounded-r-[10px] border-l-[3px] border-[#b0791a] bg-white px-3.5 py-2.5 text-[12.5px] text-[#5b665f]">
          <b className="text-[#b0791a]">Watch:</b> {snapshot.watchText}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#8b948d]">
          <Clock className="h-3 w-3" aria-hidden />
          Generated {generated}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyText()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-[#E4E4E4] bg-white px-4 text-[13px] font-bold text-ink"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy text'}
          </button>
          <button
            type="button"
            onClick={() => void handleCopyNotes()}
            disabled={copyToNotesDisabled || notesBusy}
            title={copyToNotesDisabled ? copyToNotesTooltip : undefined}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-[#E4E4E4] bg-white px-4 text-[13px] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy to case notes
          </button>
        </div>
      </div>
    </div>
  );
}
