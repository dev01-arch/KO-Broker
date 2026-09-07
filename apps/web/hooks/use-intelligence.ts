'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  intelligenceApi,
  type CreateIntelligenceSnapshotInput,
} from '@/lib/api/client';

export const intelligenceOverviewQueryKey = ['intelligence', 'overview'] as const;
export const intelligenceRatesQueryKey = ['intelligence', 'rates', 'current'] as const;
export function intelligencePreviewQueryKey(caseId: string) {
  return ['intelligence', 'preview', caseId] as const;
}

export function useIntelligenceOverview(enabled = true) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: intelligenceOverviewQueryKey,
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = (await getToken()) ?? '';
      return intelligenceApi.getOverview(token);
    },
  });
}

export function useCurrentIntelligenceRates(enabled = true) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: intelligenceRatesQueryKey,
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const token = (await getToken()) ?? '';
      return intelligenceApi.getCurrentRates(token);
    },
  });
}

export function useIntelligenceCasePreview(caseId: string | null, enabled = true) {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: intelligencePreviewQueryKey(caseId ?? ''),
    enabled: Boolean(caseId) && enabled,
    queryFn: async () => {
      const token = (await getToken()) ?? '';
      return intelligenceApi.getCasePreview(token, caseId!);
    },
  });
}

export function useCreateIntelligenceSnapshot() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIntelligenceSnapshotInput) => {
      const token = (await getToken()) ?? '';
      return intelligenceApi.createSnapshot(token, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['intelligence'] });
    },
  });
}

export function useCopyIntelligenceSnapshotToNotes() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (snapshotId: string) => {
      const token = (await getToken()) ?? '';
      return intelligenceApi.copyToNotes(token, snapshotId);
    },
  });
}
