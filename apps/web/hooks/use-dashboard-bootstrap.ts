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

export const dashboardBootstrapQueryKey = ['dashboard', 'bootstrap'] as const;

export const LIVE_CLIENTS_QUERY = { page: 1, perPage: 100 } as const;
export const LIVE_CASES_QUERY = { page: 1, perPage: 100 } as const;

export function seedDashboardQueryCache(
  queryClient: QueryClient,
  payload: ApiSuccessResponse<DashboardBootstrapPayload>,
) {
  const { data } = payload;

  if (data.org) {
    queryClient.setQueryData<OrgProfile>(orgQueryKey, data.org);
  }

  queryClient.setQueryData(clientsQueryKey(LIVE_CLIENTS_QUERY), {
    success: true as const,
    data: data.clients,
      });

  queryClient.setQueryData(casesQueryKey(LIVE_CASES_QUERY), {
    success: true as const,
    data: data.cases,
      });

  queryClient.setQueryData(advisersQueryKey, {
    success: true as const,
    data: data.advisers,
  });
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
    staleTime: 30_000,
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
