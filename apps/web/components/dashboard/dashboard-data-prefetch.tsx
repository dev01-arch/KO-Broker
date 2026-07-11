'use client';

import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { dashboardApi, requireAuthToken } from '@/lib/api/client';
import {
  dashboardBootstrapQueryKey,
  seedDashboardQueryCache,
} from '@/hooks/use-dashboard-bootstrap';

/**
 * Warms the dashboard bootstrap cache and prefetches the iframe as soon as the user is signed in.
 */
export function DashboardDataPrefetch() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || startedRef.current) return;
    startedRef.current = true;

    const iframePrefetch = document.createElement('link');
    iframePrefetch.rel = 'prefetch';
    iframePrefetch.href = '/live-demo-prototype-v2a.html';
    iframePrefetch.as = 'document';
    document.head.appendChild(iframePrefetch);

    void (async () => {
      try {
        const token = await requireAuthToken(getToken);
        const response = await dashboardApi.bootstrap(token);
        seedDashboardQueryCache(queryClient, response);
        queryClient.setQueryData(dashboardBootstrapQueryKey, response);
      } catch {
        // Prefetch is best-effort; hooks will fetch on mount.
      }
    })();
  }, [getToken, isLoaded, isSignedIn, queryClient]);

  return null;
}
