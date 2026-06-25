'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { canAccessFeature, type Plan, type Role } from '@ko/types';
import { requireAuthToken, settingsApi, type OrgProfile } from '@/lib/api/client';

export const orgQueryKey = ['settings', 'org'] as const;

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

function planLimitsEnforced(): boolean {
  return process.env.NEXT_PUBLIC_ENFORCE_PLAN_LIMITS === 'true';
}

/** Fetches org plan + role once; revalidates on window focus (Stripe webhook side effects, §15). */
export function useOrgProfile() {
  const getToken = useToken();
  const qc = useQueryClient();

  useEffect(() => {
    function onFocus() {
      void qc.invalidateQueries({ queryKey: orgQueryKey });
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [qc]);

  return useQuery({
    queryKey: orgQueryKey,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      const response = await settingsApi.getOrg(token);
      return response.data;
    },
    staleTime: 60 * 1000,
  });
}

export function usePlanFeature(feature: string) {
  const { data: profile } = useOrgProfile();
  if (process.env.NODE_ENV === 'development' && !planLimitsEnforced()) {
    return true;
  }
  const plan = profile?.plan ?? 'STARTER';
  return canAccessFeature(plan as Plan, feature);
}

export function useOrgRole(): Role | undefined {
  const { data: profile } = useOrgProfile();
  return profile?.role as Role | undefined;
}

export function useIsAdmin(): boolean {
  return useOrgRole() === 'ADMIN';
}

export type { OrgProfile };
