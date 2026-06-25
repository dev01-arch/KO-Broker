'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi, requireAuthToken, type AdvanceStageInput } from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function useAdvanceComplianceStage() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdvanceStageInput) => {
      const token = await requireAuthToken(getToken);
      return complianceApi.advanceStage(token, input);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cases'] });
      qc.invalidateQueries({ queryKey: ['cases', variables.caseId] });
    },
  });
}
