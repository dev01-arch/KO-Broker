/**
 * Cross-document handoff so the dashboard iframe can paint Overview
 * before the parent React tree finishes hydrating / posting messages.
 */

import type { ApiSuccessResponse, DashboardBootstrapPayload } from '@/lib/api/client';

export const DASHBOARD_BOOTSTRAP_STORAGE_KEY = 'ko-dashboard-bootstrap-v1';

export type DashboardBootstrapSnapshot = {
  savedAt: number;
  clients: DashboardBootstrapPayload['clients'];
  cases: DashboardBootstrapPayload['cases'];
  advisers: DashboardBootstrapPayload['advisers'];
};

const MAX_AGE_MS = 30 * 60 * 1000;

export function writeDashboardBootstrapSnapshot(
  payload: ApiSuccessResponse<DashboardBootstrapPayload> | DashboardBootstrapPayload,
) {
  if (typeof window === 'undefined') return;
  try {
    const data = 'success' in payload && payload.success ? payload.data : (payload as DashboardBootstrapPayload);
    const snapshot: DashboardBootstrapSnapshot = {
      savedAt: Date.now(),
      clients: data.clients ?? [],
      cases: data.cases ?? [],
      advisers: data.advisers ?? [],
    };
    sessionStorage.setItem(DASHBOARD_BOOTSTRAP_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function readDashboardBootstrapSnapshot(): DashboardBootstrapSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DASHBOARD_BOOTSTRAP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardBootstrapSnapshot;
    if (!parsed || !Array.isArray(parsed.clients) || !Array.isArray(parsed.cases)) return null;
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function snapshotHasLiveData(snapshot: DashboardBootstrapSnapshot | null): boolean {
  return Boolean(snapshot && (snapshot.clients.length > 0 || snapshot.cases.length > 0));
}
