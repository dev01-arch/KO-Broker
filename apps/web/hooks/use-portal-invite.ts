'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi } from '@/lib/api/client';

export function usePortalInvite() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (caseId: string) => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return portalApi.inviteClient(token, caseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
