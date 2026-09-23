const OPS_PREFIX = 'ko-prd16-case-ops:';

export type CaseOpsDraft = {
  aipAt?: string;
  submittedAt?: string;
  offerIssuedAt?: string;
  offerExpiresAt?: string;
  exchangeAt?: string;
  completionAt?: string;
  rateType?: string;
  monthlyPayment?: string;
  initialRateEndsAt?: string;
  chargeType?: string;
  isOffset?: boolean;
};

export function readCaseOpsDraft(caseId: string): CaseOpsDraft {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(OPS_PREFIX + caseId);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CaseOpsDraft;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeCaseOpsDraft(caseId: string, draft: CaseOpsDraft) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(OPS_PREFIX + caseId, JSON.stringify(draft));
  } catch {
    // Session quota / private mode — dates still PATCH to the API.
  }
}

export function isoToDateInput(iso?: string | null): string {
  if (!iso) return '';
  const slice = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : '';
}

/** Convert a date input (YYYY-MM-DD) to the ISO datetime PATCH expects. Empty → null (clear). */
export function dateInputToIso(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export type NoteEntry = { at: string; body: string };

const NOTE_BLOCK = /^\[([^\]]+)\]\n/;

export function parseNoteThread(raw: string): NoteEntry[] {
  const text = raw.trim();
  if (!text) return [];
  const parts = text.split(/\n\n(?=\[)/);
  const entries: NoteEntry[] = [];
  for (const part of parts) {
    const match = part.match(NOTE_BLOCK);
    if (match) {
      entries.push({ at: match[1], body: part.slice(match[0].length).trim() });
    } else {
      entries.push({ at: 'Earlier note', body: part.trim() });
    }
  }
  return entries.filter((entry) => entry.body);
}

export function appendNoteThread(existing: string, body: string, at = new Date()): string {
  const trimmed = body.trim();
  if (!trimmed) return existing;
  const stamp = at.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const block = `[${stamp}]\n${trimmed}`;
  const prev = existing.trim();
  return prev ? `${block}\n\n${prev}` : block;
}

export function formatPropertySummary(factFind?: {
  personalDetails?: unknown;
  propertyDetails?: unknown;
} | null): { address: string; type: string; value: string } {
  const personal =
    factFind?.personalDetails && typeof factFind.personalDetails === 'object'
      ? (factFind.personalDetails as Record<string, unknown>)
      : {};
  const property =
    factFind?.propertyDetails && typeof factFind.propertyDetails === 'object'
      ? (factFind.propertyDetails as Record<string, unknown>)
      : {};
  const addressObj =
    personal.currentAddress && typeof personal.currentAddress === 'object'
      ? (personal.currentAddress as Record<string, unknown>)
      : {};
  const parts = [addressObj.line1, addressObj.city, addressObj.postcode]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  const type = typeof property.propertyType === 'string' ? property.propertyType : '';
  const value =
    property.propertyValue != null
      ? String(property.propertyValue)
      : property.value != null
        ? String(property.value)
        : '';
  return {
    address: parts.join(', ') || 'Not recorded yet',
    type: type || '—',
    value: value || '—',
  };
}
