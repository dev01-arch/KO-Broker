'use client';

import { useQuery } from '@tanstack/react-query';
import { systemApi } from '@/lib/api/client';

export const healthQueryKey = ['system', 'health'] as const;

/** Polls GET /api/health every 5 minutes (matches uptime monitoring interval). */
export function useHealth(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: () => systemApi.healthUnchecked(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
    refetchOnMount: false,
    enabled: options?.enabled ?? true,
  });
}
