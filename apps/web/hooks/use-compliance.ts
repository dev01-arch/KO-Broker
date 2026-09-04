'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { complianceApi, requireAuthToken, type AdvanceStageInput } from '@/lib/api/client';
import {
  applyUpdatedCaseToCache,
  softInvalidateDashboardLists,
} from '@/lib/api/query-cache';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export const complianceOverviewQueryKey = ['compliance', 'overview'] as const;

export function caseComplianceQueryKey(caseId: string) {
  return ['compliance', 'case', caseId] as const;
}

export function useComplianceOverview(options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: complianceOverviewQueryKey,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return complianceApi.getOverview(token);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCaseCompliance(caseId: string | null, options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: caseComplianceQueryKey(caseId ?? ''),
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return complianceApi.getCaseChecklist(token, caseId!);
    },
    enabled: (options?.enabled ?? true) && Boolean(caseId),
  });
}

export function useAdvanceComplianceStage() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdvanceStageInput) => {
      const token = await requireAuthToken(getToken);
      return complianceApi.advanceStage(token, input);
    },
    onSuccess: (result) => {
      applyUpdatedCaseToCache(qc, result.data);
      softInvalidateDashboardLists(qc);
    },
  });
}

export function useCompleteComplianceItem() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { caseId: string; itemId: string }) => {
      const token = await requireAuthToken(getToken);
      return complianceApi.completeItem(token, input);
    },
    onSuccess: (result, input) => {
      qc.setQueryData(caseComplianceQueryKey(input.caseId), result);
      void qc.invalidateQueries({ queryKey: complianceOverviewQueryKey });
    },
  });
}
