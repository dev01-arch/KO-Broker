'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clientsApi,
  requireAuthToken,
  type ListClientsParams,
  type CreateClientInput,
  type UpdateClientInput,
} from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function clientsQueryKey(params: ListClientsParams = {}) {
  return [
    'clients',
    params.page ?? 1,
    params.perPage ?? 25,
    params.search ?? '',
    params.employmentStatus ?? '',
  ] as const;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
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
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients', id] });
    },
  });
}
