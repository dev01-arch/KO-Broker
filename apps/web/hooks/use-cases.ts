'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  casesApi,
  requireAuthToken,
  type CreateCaseInput,
  type CreateProductConsideredInput,
  type ListCasesParams,
  type UpdateCaseInput,
  type UpdateProductConsideredInput,
  type UpsertFactFindInput,
} from '@/lib/api/client';
import {
  applyCreatedCaseToCache,
  applyUpdatedCaseToCache,
  softInvalidateDashboardLists,
} from '@/lib/api/query-cache';

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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
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
    onSuccess: (result) => {
      applyCreatedCaseToCache(qc, result.data);
      softInvalidateDashboardLists(qc);
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
    onSuccess: (result) => {
      applyUpdatedCaseToCache(qc, result.data);
      softInvalidateDashboardLists(qc);
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

export function useCaseProducts(caseId: string, options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: ['cases', caseId, 'products'],
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return casesApi.listProducts(token, caseId);
    },
    enabled: (options?.enabled ?? true) && Boolean(caseId),
  });
}

export function useCreateProduct(caseId: string) {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProductConsideredInput) => {
      const token = await requireAuthToken(getToken);
      return casesApi.createProduct(token, caseId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', caseId] });
      qc.invalidateQueries({ queryKey: ['cases', caseId, 'products'] });
    },
  });
}

export function useUpdateProduct(caseId: string) {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      input,
    }: {
      productId: string;
      input: UpdateProductConsideredInput;
    }) => {
      const token = await requireAuthToken(getToken);
      return casesApi.updateProduct(token, caseId, productId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', caseId] });
      qc.invalidateQueries({ queryKey: ['cases', caseId, 'products'] });
    },
  });
}

export function useDeleteProduct(caseId: string) {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const token = await requireAuthToken(getToken);
      return casesApi.deleteProduct(token, caseId, productId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cases', caseId] });
      qc.invalidateQueries({ queryKey: ['cases', caseId, 'products'] });
    },
  });
}
