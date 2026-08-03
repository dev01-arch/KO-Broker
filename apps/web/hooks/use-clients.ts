'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clientsApi,
  requireAuthToken,
  type ClientSummary,
  type CreateClientInput,
  type ListClientsParams,
  type UpdateClientInput,
} from '@/lib/api/client';
import {
  applyCreatedClientToCache,
  softInvalidateDashboardLists,
} from '@/lib/api/query-cache';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function clientsQueryKey(params: ListClientsParams = {}) {
  return [
    'clients',
    params.page ?? 1,
    params.perPage ?? 10,
    params.search ?? '',
    params.employmentStatus ?? '',
    params.clientType ?? '',
    params.isReferred ?? '',
    params.clientCategory ?? '',
    params.status ?? '',
    params.assignedMemberId ?? '',
  ] as const;
}

function toClientSummary(
  created: { id: string; referenceNumber: string; firstName: string; lastName: string; email: string },
  input: CreateClientInput,
): ClientSummary {
  return {
    id: created.id,
    referenceNumber: created.referenceNumber,
    clientType: input.clientType ?? 'INDIVIDUAL',
    companyName: input.companyName,
    firstName: created.firstName,
    lastName: created.lastName,
    email: created.email,
    employmentStatus: input.employmentStatus ?? 'EMPLOYED',
    annualIncome: input.annualIncome,
    isReferred: input.isReferred ?? false,
    referredToCompany: input.referredToCompany,
    insurerName: input.insurerName,
    status: 'PROSPECT',
    isVulnerable: false,
    assignedMember: null,
    _count: { cases: 0, messages: 0 },
  };
}

// ─── List clients ─────────────────────────────────────────────────────────────

export function useClients(
  params: ListClientsParams = {},
  options?: { enabled?: boolean },
) {
  const getToken = useToken();
  return useQuery({
    queryKey: clientsQueryKey(params),
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return clientsApi.list(token, params);
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Get single client ────────────────────────────────────────────────────────

export function useClient(id: string) {
  const getToken = useToken();
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return clientsApi.get(token, id);
    },
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Create client ────────────────────────────────────────────────────────────

export function useCreateClient() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateClientInput) => {
      const token = await requireAuthToken(getToken);
      return clientsApi.create(token, input);
    },
    onSuccess: (result, input) => {
      applyCreatedClientToCache(qc, toClientSummary(result.data, input));
      softInvalidateDashboardLists(qc);
    },
  });
}

// ─── Update client ────────────────────────────────────────────────────────────

export function useUpdateClient(id: string) {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateClientInput) => {
      const token = await requireAuthToken(getToken);
      return clientsApi.update(token, id, input);
    },
    onSuccess: () => {
      softInvalidateDashboardLists(qc);
      void qc.invalidateQueries({ queryKey: ['clients', id] });
    },
  });
}
