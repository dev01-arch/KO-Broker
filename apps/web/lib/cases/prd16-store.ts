/**
 * PRD-16 frontend-only persistence (localStorage).
 * Used until Property / CaseNote / date columns / info-requests land in the API.
 */

export type PropertyDraft = {
  id: string;
  clientId: string;
  caseId?: string;
  postcode: string;
  line1?: string;
  city?: string;
  value?: string;
};

export type RecSnapshot = {
  loanAmount?: number | null;
  propertyValue?: number | null;
  termYears?: number | null;
  lender?: string;
  product?: string;
};

export type StaleRecord = {
  stale: boolean;
  snapshot: RecSnapshot;
  reason?: string;
};

export type InfoRequest = {
  id: string;
  caseId: string;
  label: string;
  body: string;
  documentType?: string;
  outstanding: boolean;
  createdAt: string;
  fulfilledAt?: string;
};

export type ProductExtras = {
  productType?: string;
  initialTermMonths?: string;
  ercSummary?: string;
};

type StoreShape = {
  propertiesByClient: Record<string, PropertyDraft[]>;
  propertyByCase: Record<string, PropertyDraft>;
  staleByCase: Record<string, StaleRecord>;
  requestsByCase: Record<string, InfoRequest[]>;
  extrasByProduct: Record<string, ProductExtras>;
};

const KEY = 'ko-prd16-v1';

function emptyStore(): StoreShape {
  return {
    propertiesByClient: {},
    propertyByCase: {},
    staleByCase: {},
    requestsByCase: {},
    extrasByProduct: {},
  };
}

function readStore(): StoreShape {
  if (typeof window === 'undefined') return emptyStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    return {
      ...emptyStore(),
      ...parsed,
      propertiesByClient: parsed.propertiesByClient ?? {},
      propertyByCase: parsed.propertyByCase ?? {},
      staleByCase: parsed.staleByCase ?? {},
      requestsByCase: parsed.requestsByCase ?? {},
      extrasByProduct: parsed.extrasByProduct ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(next: StoreShape) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function recommendationFingerprint(s: RecSnapshot): string {
  return [
    s.loanAmount ?? '',
    s.propertyValue ?? '',
    s.termYears ?? '',
    (s.lender ?? '').trim(),
    (s.product ?? '').trim(),
  ].join('|');
}

export function factsMoved(prev: RecSnapshot, next: RecSnapshot): boolean {
  return (
    (prev.loanAmount ?? null) !== (next.loanAmount ?? null) ||
    (prev.propertyValue ?? null) !== (next.propertyValue ?? null) ||
    (prev.termYears ?? null) !== (next.termYears ?? null)
  );
}

export function upsertCaseProperty(draft: PropertyDraft): PropertyDraft {
  const store = readStore();
  const id = draft.id || `prop_${Date.now()}`;
  const saved: PropertyDraft = { ...draft, id, postcode: draft.postcode.trim().toUpperCase() };
  store.propertyByCase[saved.caseId || id] = saved;
  if (saved.caseId) store.propertyByCase[saved.caseId] = saved;
  const list = store.propertiesByClient[saved.clientId] ?? [];
  const idx = list.findIndex(
    (item) => item.id === saved.id || (saved.caseId && item.caseId === saved.caseId),
  );
  if (idx >= 0) list[idx] = saved;
  else list.push(saved);
  store.propertiesByClient[saved.clientId] = list;
  writeStore(store);
  return saved;
}

export function readCaseProperty(caseId: string): PropertyDraft | undefined {
  return readStore().propertyByCase[caseId];
}

export function listClientProperties(clientId: string): PropertyDraft[] {
  return readStore().propertiesByClient[clientId] ?? [];
}

export function markRecommendationSnapshot(caseId: string, snapshot: RecSnapshot) {
  const store = readStore();
  store.staleByCase[caseId] = { stale: false, snapshot, reason: undefined };
  writeStore(store);
}

export function forceStale(caseId: string, reason?: string) {
  const store = readStore();
  const prev = store.staleByCase[caseId];
  if (!prev?.snapshot?.lender && !prev?.snapshot?.product) return false;
  store.staleByCase[caseId] = {
    ...prev,
    stale: true,
    reason: reason ?? 'Facts changed since this product was selected.',
  };
  writeStore(store);
  return true;
}

export function markFactsStale(caseId: string, nextFacts: RecSnapshot, reason?: string) {
  const store = readStore();
  const prev = store.staleByCase[caseId];
  if (!prev?.snapshot?.lender && !prev?.snapshot?.product) return false;
  if (!factsMoved(prev.snapshot, nextFacts)) return prev.stale;
  store.staleByCase[caseId] = {
    ...prev,
    stale: true,
    reason: reason ?? 'Facts changed since this product was selected.',
  };
  writeStore(store);
  return true;
}

export function clearStale(caseId: string, snapshot: RecSnapshot) {
  const store = readStore();
  store.staleByCase[caseId] = { stale: false, snapshot };
  writeStore(store);
}

export function readStale(caseId: string): StaleRecord | undefined {
  return readStore().staleByCase[caseId];
}

export function addInfoRequest(
  caseId: string,
  input: { label: string; body: string; documentType?: string },
): InfoRequest {
  const store = readStore();
  const req: InfoRequest = {
    id: `req_${Date.now()}`,
    caseId,
    label: input.label,
    body: input.body,
    documentType: input.documentType,
    outstanding: true,
    createdAt: new Date().toISOString(),
  };
  store.requestsByCase[caseId] = [...(store.requestsByCase[caseId] ?? []), req];
  writeStore(store);
  return req;
}

export function listInfoRequests(caseId: string): InfoRequest[] {
  return readStore().requestsByCase[caseId] ?? [];
}

export function fulfilInfoRequests(caseId: string, documentType?: string): InfoRequest[] {
  const store = readStore();
  const list = store.requestsByCase[caseId] ?? [];
  const now = new Date().toISOString();
  const next = list.map((req) => {
    if (!req.outstanding) return req;
    if (documentType && req.documentType && req.documentType !== documentType) return req;
    return { ...req, outstanding: false, fulfilledAt: now };
  });
  store.requestsByCase[caseId] = next;
  writeStore(store);
  return next;
}

export function writeProductExtras(productId: string, extras: ProductExtras) {
  const store = readStore();
  store.extrasByProduct[productId] = extras;
  writeStore(store);
}

export function readProductExtras(productId: string): ProductExtras | undefined {
  return readStore().extrasByProduct[productId];
}

export function isWithinDays(iso: string | undefined, days: number, now = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  const diff = t - now;
  return diff >= 0 && diff <= days * 86_400_000;
}

export function radarCaseIds(
  caseIds: string[],
  kind: 'offers14' | 'rates90',
  readDates: (caseId: string) => { offerExpiresAt?: string; initialRateEndsAt?: string },
  now = Date.now(),
): string[] {
  const days = kind === 'offers14' ? 14 : 90;
  return caseIds.filter((id) => {
    const draft = readDates(id);
    const iso = kind === 'offers14' ? draft.offerExpiresAt : draft.initialRateEndsAt;
    return isWithinDays(iso, days, now);
  });
}
