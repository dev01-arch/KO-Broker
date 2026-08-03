'use client';

import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
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

/**
 * Fetches org plan + role. Prefer bootstrap-seeded cache; avoid aggressive
 * focus refetching (Stripe plan changes are rare and settings can invalidate).
 */
export function useOrgProfile() {
  const getToken = useToken();

  return useQuery({
    queryKey: orgQueryKey,
    queryFn: async () => {
      const token = await requireAuthToken(getToken);
      const response = await settingsApi.getOrg(token);
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function usePlanFeature(feature: string) {
  const { data: profile } = useOrgProfile();
  if (!planLimitsEnforced()) {
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

/** Per-adviser visibility from org profile. ADMIN always true. */
export function useAdviserVisibility() {
  const { data: profile } = useOrgProfile();
  const isAdmin = profile?.role === 'ADMIN';
  return {
    canViewAllClients: isAdmin || Boolean(profile?.canViewAllClients),
    canViewAccountDetails: isAdmin || Boolean(profile?.canViewAccountDetails),
    canViewAiSummaries: isAdmin || Boolean(profile?.canViewAiSummaries),
  };
}

export type { OrgProfile };
