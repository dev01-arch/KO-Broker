'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  aiApi,
  requireAuthToken,
  type GenerateReportInput,
  type RegenerateSectionInput,
} from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function aiReportsQueryKey(params: { page?: number; perPage?: number; caseId?: string } = {}) {
  return ['ai-reports', params.page ?? 1, params.perPage ?? 25, params.caseId ?? ''] as const;
}

export function useAiReports(
  params: { page?: number; perPage?: number; caseId?: string } = {},
  options?: { enabled?: boolean },
) {
  const getToken = useToken();
  return useQuery({
    queryKey: aiReportsQueryKey(params),
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return aiApi.listReports(token, params);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useGenerateReport() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateReportInput) => {
      const token = await requireAuthToken(getToken);
      return aiApi.generateReport(token, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-reports'] });
    },
  });
}

export function useRegenerateSection() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegenerateSectionInput) => {
      const token = await requireAuthToken(getToken);
      return aiApi.regenerateSection(token, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-reports'] });
    },
  });
}

export function useApproveReport() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await requireAuthToken(getToken);
      return aiApi.approveReport(token, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-reports'] });
    },
  });
}
