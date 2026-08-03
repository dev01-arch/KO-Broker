'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  dashboardApi,
  requireAuthToken,
  type ApiSuccessResponse,
  type DashboardBootstrapPayload,
  type OrgProfile,
} from '@/lib/api/client';
import { clientsQueryKey } from '@/hooks/use-clients';
import { casesQueryKey } from '@/hooks/use-cases';
import { orgQueryKey } from '@/hooks/use-org';
import { advisersQueryKey } from '@/hooks/use-settings';
import { writeDashboardBootstrapSnapshot, readDashboardBootstrapSnapshot } from '@/lib/api/dashboard-cache';

export const dashboardBootstrapQueryKey = ['dashboard', 'bootstrap'] as const;

export const LIVE_CLIENTS_QUERY = { page: 1, perPage: 100 } as const;
export const LIVE_CASES_QUERY = { page: 1, perPage: 100 } as const;
/** Clients table page — seeded from bootstrap so the list is warm. */
export const CLIENTS_PAGE_QUERY = { page: 1, perPage: 10 } as const;

export function seedDashboardQueryCache(
  queryClient: QueryClient,
  payload: ApiSuccessResponse<DashboardBootstrapPayload>,
) {
  const { data } = payload;

  if (data.org) {
    queryClient.setQueryData<OrgProfile>(orgQueryKey, data.org);
  }

  const clientsLive = {
    success: true as const,
    data: data.clients,
    meta: { total: data.clients.length, page: 1, perPage: LIVE_CLIENTS_QUERY.perPage },
  };
  queryClient.setQueryData(clientsQueryKey(LIVE_CLIENTS_QUERY), clientsLive);

  // Seed the clients table page key so /dashboard/clients is warm.
  queryClient.setQueryData(clientsQueryKey(CLIENTS_PAGE_QUERY), {
    success: true as const,
    data: data.clients.slice(0, CLIENTS_PAGE_QUERY.perPage),
    meta: {
      total: data.clients.length,
      page: CLIENTS_PAGE_QUERY.page,
      perPage: CLIENTS_PAGE_QUERY.perPage,
    },
  });

  queryClient.setQueryData(casesQueryKey(LIVE_CASES_QUERY), {
    success: true as const,
    data: data.cases,
    meta: { total: data.cases.length, page: 1, perPage: LIVE_CASES_QUERY.perPage },
  });

  queryClient.setQueryData(advisersQueryKey, {
    success: true as const,
    data: data.advisers,
  });

  writeDashboardBootstrapSnapshot(payload);
}

function bootstrapPlaceholderFromSession():
  | ApiSuccessResponse<DashboardBootstrapPayload>
  | undefined {
  const snap = readDashboardBootstrapSnapshot();
  if (!snap || (snap.clients.length === 0 && snap.cases.length === 0)) return undefined;
  return {
    success: true,
    data: {
      org: null,
      clients: snap.clients,
      cases: snap.cases,
      advisers: snap.advisers,
    },
  };
}

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function useDashboardBootstrap(options?: { enabled?: boolean }) {
  const getToken = useToken();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardBootstrapQueryKey,
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
    placeholderData: bootstrapPlaceholderFromSession,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return dashboardApi.bootstrap(token);
    },
  });

  useEffect(() => {
    if (!query.data) return;
    seedDashboardQueryCache(queryClient, query.data);
  }, [query.data, queryClient]);

  return query;
}
