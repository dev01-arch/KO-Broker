'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  casesApi,
  requireAuthToken,
  type CreateCaseInput,
  type ListCasesParams,
  type UpdateCaseInput,
  type UpsertFactFindInput,
} from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function casesQueryKey(params: ListCasesParams = {}) {
  return [
    'cases',
    params.page ?? 1,
    params.perPage ?? 25,
    params.search ?? '',
    params.stage ?? '',
    params.type ?? '',
    params.clientId ?? '',
    params.adviserId ?? '',
  ] as const;
}

export function useCases(
  params: ListCasesParams = {},
  options?: { enabled?: boolean },
) {
  const getToken = useToken();
  return useQuery({
    queryKey: casesQueryKey(params),
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return casesApi.list(token, params);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCase(id: string) {
  const getToken = useToken();
  return useQuery({
    queryKey: ['cases', id],
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return casesApi.get(token, id);
    },
    enabled: Boolean(id),
  });
}

export function useCreateCase() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCaseInput) => {
      const token = await requireAuthToken(getToken);
      return casesApi.create(token, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateCase(id: string) {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCaseInput) => {
      const token = await requireAuthToken(getToken);
      return casesApi.update(token, id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['cases', id] });
    },
  });
}

export function useUpsertFactFind(caseId: string) {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertFactFindInput) => {
      const token = await requireAuthToken(getToken);
      return casesApi.upsertFactFind(token, caseId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', caseId] });
    },
  });
}
