/**
 * Shared React Query cache helpers for dashboard lists + bootstrap.
 * Keeps UI instant after creates/updates without waiting on refetches.
 */

import type { QueryClient } from '@tanstack/react-query';
import type {
  ApiSuccessResponse,
  CaseSummary,
  ClientSummary,
  DashboardBootstrapPayload,
} from '@/lib/api/client';
import {
  dashboardBootstrapQueryKey,
  LIVE_CASES_QUERY,
  LIVE_CLIENTS_QUERY,
  CLIENTS_PAGE_QUERY,
} from '@/hooks/use-dashboard-bootstrap';

type ListCache<T> = ApiSuccessResponse<T[]>;
type BootstrapCache = ApiSuccessResponse<DashboardBootstrapPayload>;

export { CLIENTS_PAGE_QUERY };

/** Mirrors `clientsQueryKey` defaults so we don't create a circular hook import. */
function clientsListKey(params: { page?: number; perPage?: number } = {}) {
  return [
    'clients',
    params.page ?? 1,
    params.perPage ?? 10,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ] as const;
}

/** Mirrors `casesQueryKey` defaults. */
function casesListKey(params: { page?: number; perPage?: number } = {}) {
  return [
    'cases',
    params.page ?? 1,
    params.perPage ?? 25,
    '',
    '',
    '',
    '',
    '',
  ] as const;
}

function prependUniqueById<T extends { id: string }>(list: T[], item: T): T[] {
  return [item, ...list.filter((row) => row.id !== item.id)];
}

function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((row) => row.id === item.id);
  if (idx < 0) return prependUniqueById(list, item);
  const next = list.slice();
  next[idx] = { ...list[idx], ...item };
  return next;
}

function removeById<T extends { id: string }>(list: T[], ids: string[]): T[] {
  const idSet = new Set(ids);
  return list.filter((row) => !idSet.has(row.id));
}

function bumpMeta(meta: ListCache<unknown>['meta'] | undefined, delta: number) {
  if (!meta || typeof meta.total !== 'number') return meta;
  return { ...meta, total: Math.max(0, meta.total + delta) };
}

function patchListCaches<T extends { id: string }>(
  qc: QueryClient,
  rootKey: 'clients' | 'cases',
  preferredKeys: readonly (readonly unknown[])[],
  updater: (list: T[], meta: ListCache<T>['meta']) => { data: T[]; meta?: ListCache<T>['meta'] },
) {
  const touched = new Set<string>();

  for (const key of preferredKeys) {
    const old = qc.getQueryData<ListCache<T>>(key);
    if (!old?.data) continue;
    const next = updater(old.data, old.meta);
    qc.setQueryData(key, { ...old, data: next.data, meta: next.meta });
    touched.add(JSON.stringify(key));
  }

  for (const [key, old] of qc.getQueriesData<ListCache<T>>({ queryKey: [rootKey] })) {
    if (!old?.data) continue;
    if (touched.has(JSON.stringify(key))) continue;
    // Skip detail keys like ['clients', id]
    if (!Array.isArray(key) || typeof key[1] !== 'number') continue;
    const next = updater(old.data, old.meta);
    qc.setQueryData(key, { ...old, data: next.data, meta: next.meta });
  }
}

function patchBootstrap(
  qc: QueryClient,
  updater: (payload: DashboardBootstrapPayload) => DashboardBootstrapPayload,
) {
  const old = qc.getQueryData<BootstrapCache>(dashboardBootstrapQueryKey);
  if (!old?.data) return;
  qc.setQueryData(dashboardBootstrapQueryKey, {
    ...old,
    data: updater(old.data),
  });
}

/** Insert a newly created client into bootstrap + list caches. */
export function applyCreatedClientToCache(qc: QueryClient, client: ClientSummary) {
  patchBootstrap(qc, (data) => ({
    ...data,
    clients: prependUniqueById(data.clients, client),
  }));

  patchListCaches<ClientSummary>(
    qc,
    'clients',
    [clientsListKey(LIVE_CLIENTS_QUERY), clientsListKey(CLIENTS_PAGE_QUERY)],
    (list, meta) => ({
      data: prependUniqueById(list, client),
      meta: bumpMeta(meta, list.some((c) => c.id === client.id) ? 0 : 1),
    }),
  );

  qc.setQueryData(['clients', client.id], { success: true as const, data: client });
}

/** Insert a newly created case into bootstrap + list caches. */
export function applyCreatedCaseToCache(qc: QueryClient, caseRow: CaseSummary) {
  patchBootstrap(qc, (data) => ({
    ...data,
    cases: prependUniqueById(data.cases, caseRow),
    clients: data.clients.map((client) =>
      client.id === caseRow.clientId
        ? {
            ...client,
            _count: {
              ...client._count,
              cases: (client._count?.cases ?? 0) + 1,
            },
          }
        : client,
    ),
  }));

  patchListCaches<CaseSummary>(
    qc,
    'cases',
    [casesListKey(LIVE_CASES_QUERY)],
    (list, meta) => ({
      data: prependUniqueById(list, caseRow),
      meta: bumpMeta(meta, list.some((c) => c.id === caseRow.id) ? 0 : 1),
    }),
  );

  patchListCaches<ClientSummary>(
    qc,
    'clients',
    [clientsListKey(LIVE_CLIENTS_QUERY), clientsListKey(CLIENTS_PAGE_QUERY)],
    (list, meta) => ({
      data: list.map((client) =>
        client.id === caseRow.clientId
          ? {
              ...client,
              _count: {
                ...client._count,
                cases: (client._count?.cases ?? 0) + 1,
              },
            }
          : client,
      ),
      meta,
    }),
  );

  qc.setQueryData(['cases', caseRow.id], { success: true as const, data: caseRow });
}

/** Merge an updated case (e.g. stage advance) into caches. */
export function applyUpdatedCaseToCache(qc: QueryClient, caseRow: CaseSummary) {
  patchBootstrap(qc, (data) => ({
    ...data,
    cases: replaceById(data.cases, caseRow),
  }));

  patchListCaches<CaseSummary>(
    qc,
    'cases',
    [casesListKey(LIVE_CASES_QUERY)],
    (list, meta) => ({
      data: replaceById(list, caseRow),
      meta,
    }),
  );

  const existingDetail = qc.getQueryData<ApiSuccessResponse<CaseSummary>>(['cases', caseRow.id]);
  if (existingDetail?.data) {
    qc.setQueryData(['cases', caseRow.id], {
      ...existingDetail,
      data: { ...existingDetail.data, ...caseRow },
    });
  } else {
    qc.setQueryData(['cases', caseRow.id], { success: true as const, data: caseRow });
  }
}

/** Remove deleted clients from caches. */
export function applyDeletedClientsToCache(qc: QueryClient, clientIds: string[]) {
  if (clientIds.length === 0) return;

  patchBootstrap(qc, (data) => ({
    ...data,
    clients: removeById(data.clients, clientIds),
    cases: data.cases.filter((c) => !clientIds.includes(c.clientId)),
  }));

  patchListCaches<ClientSummary>(
    qc,
    'clients',
    [clientsListKey(LIVE_CLIENTS_QUERY), clientsListKey(CLIENTS_PAGE_QUERY)],
    (list, meta) => {
      const next = removeById(list, clientIds);
      return {
        data: next,
        meta: bumpMeta(meta, next.length - list.length),
      };
    },
  );

  patchListCaches<CaseSummary>(
    qc,
    'cases',
    [casesListKey(LIVE_CASES_QUERY)],
    (list, meta) => {
      const next = list.filter((c) => !clientIds.includes(c.clientId));
      return {
        data: next,
        meta: bumpMeta(meta, next.length - list.length),
      };
    },
  );

  for (const id of clientIds) {
    qc.removeQueries({ queryKey: ['clients', id] });
  }
}

/** Background revalidation — do not await. */
export function softInvalidateDashboardLists(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['clients'], refetchType: 'active' });
  void qc.invalidateQueries({ queryKey: ['cases'], refetchType: 'active' });
  void qc.invalidateQueries({ queryKey: ['compliance'], refetchType: 'active' });
  void qc.invalidateQueries({
    queryKey: dashboardBootstrapQueryKey,
    refetchType: 'none',
  });
}
