'use client';

import { useAuth } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  messagesApi,
  requireAuthToken,
  type ApiSuccessResponse,
  type ListMessagesParams,
  type MessageRecord,
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

type MessagesCacheSnapshot = [readonly unknown[], ApiSuccessResponse<MessageRecord[]> | undefined][];

/** Optimistically mark message(s) read across all cached message queries. */
export function applyMessagesReadToCache(
  qc: ReturnType<typeof useQueryClient>,
  ids: string[],
) {
  const idSet = new Set(ids);
  const entries = qc.getQueriesData<ApiSuccessResponse<MessageRecord[]>>({
    queryKey: ['messages'],
  });
  for (const [key, old] of entries) {
    if (!old?.data) continue;
    const unreadOnly = Array.isArray(key) && key[5] === true;
    if (unreadOnly) {
      const nextData = old.data.filter((m) => !idSet.has(m.id));
      const removed = old.data.length - nextData.length;
      qc.setQueryData(key, {
        ...old,
        data: nextData,
        meta:
          old.meta?.total != null
            ? { ...old.meta, total: Math.max(0, old.meta.total - removed) }
            : old.meta,
      });
    } else {
      qc.setQueryData(key, {
        ...old,
        data: old.data.map((m) => (idSet.has(m.id) ? { ...m, isRead: true } : m)),
      });
    }
  }
}

export function useMarkMessageRead() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await requireAuthToken(getToken);
      return messagesApi.markRead(token, id);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['messages'] });
      const snapshots = qc.getQueriesData<ApiSuccessResponse<MessageRecord[]>>({
        queryKey: ['messages'],
      }) as MessagesCacheSnapshot;
      applyMessagesReadToCache(qc, [id]);
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}
