'use client';

import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { dashboardApi, requireAuthToken, settingsApi } from '@/lib/api/client';
import {
  dashboardBootstrapQueryKey,
  seedDashboardQueryCache,
} from '@/hooks/use-dashboard-bootstrap';
import {
  advisersQueryKey,
  integrationsQueryKey,
  messagingQueryKey,
} from '@/hooks/use-settings';
import { writeDashboardBootstrapSnapshot } from '@/lib/api/dashboard-cache';

const IFRAME_HREF = '/live-demo-prototype-v2a.html';

function ensureIframePreload() {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[data-ko-iframe-preload="${IFRAME_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'document';
  link.href = IFRAME_HREF;
  link.setAttribute('data-ko-iframe-preload', IFRAME_HREF);
  document.head.appendChild(link);
}

/**
 * Warms the dashboard bootstrap cache and preloads the iframe as soon as the user is signed in.
 * Settings queries are idle-deferred so they don't contend with first-paint route compiles.
 */
export function DashboardDataPrefetch() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const queryClient = useQueryClient();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || startedRef.current) return;
    startedRef.current = true;

    // Preload beats prefetch for first dashboard paint after sign-in.
    ensureIframePreload();

    void (async () => {
      try {
        const token = await requireAuthToken(getToken);
        // Deduped with useDashboardBootstrap via the shared query key.
        const response = await queryClient.fetchQuery({
          queryKey: dashboardBootstrapQueryKey,
          queryFn: () => dashboardApi.bootstrap(token),
          staleTime: 5 * 60 * 1000,
        });
        seedDashboardQueryCache(queryClient, response);
        writeDashboardBootstrapSnapshot(response);

        // Defer settings warm so cold API compiles don't compete with first dashboard paint.
        const warmSettings = () => {
          void Promise.all([
            queryClient
              .fetchQuery({
                queryKey: integrationsQueryKey,
                queryFn: () => settingsApi.getIntegrations(token),
                staleTime: 5 * 60 * 1000,
              })
              .catch(() => null),
            queryClient
              .fetchQuery({
                queryKey: messagingQueryKey,
                queryFn: () => settingsApi.getMessaging(token),
                staleTime: 5 * 60 * 1000,
              })
              .catch(() => null),
            queryClient
              .fetchQuery({
                queryKey: advisersQueryKey,
                queryFn: () => settingsApi.listAdvisers(token),
                staleTime: 5 * 60 * 1000,
              })
              .catch(() => null),
          ]);
        };
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(warmSettings, { timeout: 8000 });
        } else {
          setTimeout(warmSettings, 4000);
        }
      } catch {
        // Prefetch is best-effort; hooks will fetch on mount.
      }
    })();
  }, [getToken, isLoaded, isSignedIn, queryClient]);

  return null;
}
