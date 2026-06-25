'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  messagesApi,
  requireAuthToken,
  type ListMessagesParams,
  type SendMessageInput,
} from '@/lib/api/client';

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

export function messagesQueryKey(params: ListMessagesParams = {}) {
  return [
    'messages',
    params.page ?? 1,
    params.perPage ?? 25,
    params.caseId ?? '',
    params.clientId ?? '',
    params.unreadOnly ?? false,
  ] as const;
}

export function useMessages(params: ListMessagesParams = {}, options?: { enabled?: boolean }) {
  const getToken = useToken();
  return useQuery({
    queryKey: messagesQueryKey(params),
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      return messagesApi.list(token, params);
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useSendMessage() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const token = await requireAuthToken(getToken);
      return messagesApi.send(token, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useMarkMessageRead() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await requireAuthToken(getToken);
      return messagesApi.markRead(token, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
