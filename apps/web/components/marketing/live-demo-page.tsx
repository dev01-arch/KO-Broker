'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Building2, Calculator as CalculatorIcon, FileText, Loader2, Settings, Upload, type LucideIcon } from 'lucide-react';
import MortgageCalculators from '@/components/marketing/demo-calculator/MortgageCalculators';
import { IntegrationsSettingsPanel } from '@/components/dashboard/integrations-settings-panel';
import { clientsQueryKey, useClients, useCreateClient } from '@/hooks/use-clients';
import { advisersQueryKey, useAdvisers } from '@/hooks/use-settings';
import {
  useDashboardBootstrap,
  LIVE_CLIENTS_QUERY,
  LIVE_CASES_QUERY,
  dashboardBootstrapQueryKey,
} from '@/hooks/use-dashboard-bootstrap';
import { usePortalInvite } from '@/hooks/use-portal-invite';
import { casesQueryKey, useCases, useCreateCase } from '@/hooks/use-cases';
import { useAdviserVisibility, useIsAdmin, usePlanFeature } from '@/hooks/use-org';
import { useUploadDocument } from '@/hooks/use-documents';
import { useMarkMessageRead, useMessages, applyMessagesReadToCache } from '@/hooks/use-messages';
import { clearAuthenticated, getSessionUsername } from '@/lib/auth/demo-session';
import {
  aiApi,
  casesApi,
  clientsApi,
  complianceApi,
  documentsApi,
  formatApiError,
  getApiErrorFieldMap,
  getApiErrorDetails,
  isApiErrorCode,
  API_ERROR_CODES,
  messagesApi,
  normalizeAiReportSections,
  type AiReport,
  type Case,
  type CaseSummary,
  type CaseStage,
  type ClientSummary,
  type CreateCaseInput,
  type CreateClientInput,
  type AdviserRecord,
  type DocumentType,
  type MessageRecord,
  type MessageChannel,
  type MessageDeliveryMeta,
  type ReportTemplate,
  type TimelineEntry,
  type ProductConsidered,
  type UpsertFactFindInput,
  type ApiSuccessResponse,
} from '@/lib/api/client';
import { formatClientName, formatClientInitials } from '@/lib/api/client-display';
import {
  applyCreatedCaseToCache,
  applyCreatedClientToCache,
  applyDeletedClientsToCache,
  applyUpdatedCaseToCache,
  softInvalidateDashboardLists,
} from '@/lib/api/query-cache';
import {
  readDashboardBootstrapSnapshot,
  writeDashboardBootstrapSnapshot,
} from '@/lib/api/dashboard-cache';

/** Persist current bootstrap-shaped lists so the iframe can paint instantly next load. */
function persistLiveListsSnapshot(
  clients: ClientSummary[],
  cases: CaseSummary[],
  advisers: AdviserRecord[],
) {
  writeDashboardBootstrapSnapshot({
    org: null,
    clients,
    cases,
    advisers,
  });
}

// ── Inline upload modal used by the live demo iframe ─────────────────────────

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'ID', label: 'Identity' },
  { value: 'INCOME', label: 'Income' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'LENDER', label: 'Lender' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'OTHER', label: 'Other' },
];

function IframeUploadModal({
  caseId,
  onClose,
  onUploaded,
}: {
  caseId: string | null;
  onClose: () => void;
  onUploaded: (doc: { id: string; name: string; documentType: DocumentType; caseId?: string }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('OTHER');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: upload, isPending } = useUploadDocument();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { setError('Please select a file.'); return; }
    if (!caseId) { setError('No case selected.'); return; }
    setError(null);
    try {
      const result = await upload({ file: selectedFile, documentType: docType, caseId });
      onUploaded({ id: result.data.id, name: result.data.name, documentType: result.data.documentType as DocumentType, caseId: result.data.caseId ?? caseId ?? undefined });
      onClose();
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Upload failed. Please try again.' }));
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-bold text-gray-900">Upload Document</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${selectedFile ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-gray-50 hover:border-teal-300'}`}
            >
              {selectedFile ? (
                <>
                  <FileText className="h-8 w-8 text-teal-500" />
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[260px]">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || 'file'}</p>
                  <button type="button" onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs text-gray-400 hover:text-red-500 underline">Remove</button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">Click to choose a file</p>
                  <p className="text-xs text-gray-400">PDF, images, Word, Excel — up to 50 MB</p>
                </>
              )}
              <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Document type</label>
              <select value={docType} onChange={e => setDocType(e.target.value as DocumentType)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none">
                {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!selectedFile || isPending} className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const LIVE_CLIENTS_QUERY_DEMO = { page: 1, perPage: 100 } as const;
const LIVE_CASES_QUERY_DEMO = { page: 1, perPage: 100 } as const;

type DemoTab = 'overview' | 'clients' | 'cases' | 'messages' | 'ai' | 'calculator' | 'settings';

const DEMO_TABS: readonly DemoTab[] = [
  'overview',
  'clients',
  'cases',
  'messages',
  'ai',
  'calculator',
  'settings',
] as const;

/** Map `?tab=` (and iframe aliases) → parent DemoTab. */
function demoTabFromParam(raw: string | null | undefined): DemoTab | null {
  if (!raw) return null;
  if (raw === 'calculators') return 'calculator';
  // Iframe-only nav item — keep the iframe visible (not an embedded React panel).
  if (raw === 'compliance') return 'overview';
  if ((DEMO_TABS as readonly string[]).includes(raw)) return raw as DemoTab;
  return null;
}

function demoTabToParam(tab: DemoTab): string | null {
  if (tab === 'overview') return null;
  return tab;
}

/** Iframe query `tab` value for the HTML prototype. */
function demoTabToIframeParam(tab: DemoTab): string {
  if (tab === 'calculator') return 'calculators';
  if (tab === 'settings') return 'overview';
  return tab;
}

function resolveDemoTabFromSearch(sp: { get: (key: string) => string | null }): DemoTab {
  const billing = sp.get('billing');
  if (billing === 'success' || billing === 'cancel') return 'settings';
  return demoTabFromParam(sp.get('tab')) ?? 'overview';
}

/** Prefer the address bar — Next soft-nav can lag behind optimistic tab switches. */
function readLocationSearchParams(
  fallback: { toString: () => string },
): URLSearchParams {
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams(fallback.toString());
}

function locationHref(pathname: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

type NavItem =
  | { id: DemoTab; label: string; iconUrl: string }
  | { id: DemoTab; label: string; icon: LucideIcon };

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', iconUrl: '/assets/dashboard_customize.svg' },
  { id: 'clients', label: 'Clients', iconUrl: '/assets/people.svg' },
  { id: 'cases', label: 'Cases', iconUrl: '/assets/cases.svg' },
  { id: 'messages', label: 'Messages', iconUrl: '/assets/chat.svg' },
  { id: 'ai', label: 'Reports', iconUrl: '/assets/smart_toy.svg' },
  { id: 'calculator', label: 'Calculator', icon: CalculatorIcon },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Bottom nav shows 5 primary tabs on mobile; AI Reports + Calculator live under Settings.
const MOBILE_NAV_IDS: DemoTab[] = ['overview', 'clients', 'cases', 'messages', 'settings'];
const mobileNavItems = navItems.filter((item) => MOBILE_NAV_IDS.includes(item.id));
// Teal filter (#00B8D9) applied to black SVG icon images on active state.
const MOBILE_ICON_ACTIVE_FILTER =
  'invert(55%) sepia(94%) saturate(400%) hue-rotate(155deg) brightness(100%) contrast(100%)';

function isEmbeddedPanelTab(tab: DemoTab): tab is 'calculator' | 'settings' {
  return tab === 'calculator' || tab === 'settings';
}

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function resolveClerkDisplayName(clerkUser: ReturnType<typeof useUser>['user']): string | null {
  if (!clerkUser) return null;
  if (clerkUser.fullName) return clerkUser.fullName;
  const first = clerkUser.firstName;
  const last = clerkUser.lastName;
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (email) return email.split('@')[0] ?? null;
  return null;
}


function applyGreetingToIframe(doc: Document, displayName: string) {
  const greetEl = doc.querySelector('.dash-greet-name');
  if (greetEl) {
    greetEl.textContent = `${timeGreeting()}, ${displayName}`;
  }
}

const DEMO_NOTIFICATIONS = [
  { id: 'demo-1', initials: 'SM', name: 'Sarah Mitchell', preview: 'Uploaded 2 new documents to KOC-0001-A', time: '2m ago', color: '#CE652D' },
  { id: 'demo-2', initials: 'JJ', name: 'James John', preview: 'Requested a call-back for KOC-0012', time: '14m ago', color: '#2D9D7A' },
  { id: 'demo-3', initials: 'S', name: 'System', preview: 'Lender criteria updated — 3 products affected', time: '1h ago', color: '#00B8D9' },
  { id: 'demo-4', initials: 'JJ', name: 'Jane Joe', preview: 'Signed the suitability letter', time: '2h ago', color: '#857ABE' },
  { id: 'demo-5', initials: 'AS', name: 'Amon Stone', preview: 'New enquiry submitted via portal', time: '3h ago', color: '#E04B4B' },
] as const;

const NOTIF_AVATAR_COLORS = ['#CE652D', '#2D9D7A', '#00B8D9', '#857ABE', '#E04B4B', '#0F6E56'] as const;

type NotificationItem = {
  id: string;
  initials: string;
  name: string;
  preview: string;
  time: string;
  color: string;
  caseId?: string;
};

type MessageWithContext = MessageRecord & {
  client?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string | null;
    clientType?: ClientSummary['clientType'];
  } | null;
  case?: { id?: string; referenceNumber?: string } | null;
};

function formatNotifRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.round(diff / 60000);
  const hours = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

type LiveDemoPageProps = {
  /** Logo link target — `/` on marketing demo, `/dashboard` when signed in. */
  homeHref?: string;
};

export function LiveDemoPage({ homeHref = '/' }: LiveDemoPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { getToken, signOut, isLoaded: authLoaded, isSignedIn } = useAuth();
  const [demoUsername, setDemoUsername] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DemoTab>(() => resolveDemoTabFromSearch(searchParams));
  /** First iframe paint uses this so reload restores the URL tab without remounting on every switch. */
  const initialIframeTabRef = useRef<string>(
    (() => {
      const raw = searchParams.get('tab');
      if (raw === 'compliance') return 'compliance';
      if (raw === 'calculators') return 'calculators';
      return demoTabToIframeParam(resolveDemoTabFromSearch(searchParams));
    })(),
  );
  /** Skip the first ko:switch-tab after load — iframe already opened on the URL tab. */
  const skipNextIframeTabSyncRef = useRef(true);
  /**
   * Tab we just wrote to the address bar via history API.
   * Ignores stale Next `useSearchParams` until the router catches up (or the user goes back).
   */
  const pendingTabUrlRef = useRef<DemoTab | 'compliance' | null>(null);
  /** Once opened, keep Settings/Calculator mounted (hidden) so return visits don't remount. */
  const [settingsMounted, setSettingsMounted] = useState(false);
  const [calculatorMounted, setCalculatorMounted] = useState(false);
  const isDashboard = homeHref === '/dashboard';
  const isClerkUser = Boolean(user);
  const [frameHeight, setFrameHeight] = useState<number>(1200);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [factFindOpen, setFactFindOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [uploadModal, setUploadModal] = useState<{ caseId: string } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [demoUnreadNotifIds, setDemoUnreadNotifIds] = useState<string[]>(() =>
    DEMO_NOTIFICATIONS.map((n) => n.id),
  );
  const [markingAllNotifs, setMarkingAllNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!notifOpen && !profileOpen) return;
    function handleOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [notifOpen, profileOpen]);
  // Stable ref so onLoad/click closures always call the current getToken.
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  // Track the currently open case so async click handlers can reference it.
  const activeCaseIdRef = useRef<string>('');
  // Cache opened case detail for cross-tab message sync.
  const caseDetailRef = useRef<
    Record<
      string,
      {
        referenceNumber?: string;
        type?: string;
        stage?: string;
        client?: { firstName?: string; lastName?: string };
        selectedLender?: string;
        selectedProduct?: string;
        selectedRate?: number;
        selectedFee?: number;
        adviserNotes?: string;
        loanAmount?: number;
      }
    >
  >({});
  const hubMessagesRef = useRef<Record<string, MessageRecord[]>>({});
  /** In-flight optimistic sends — never dropped by list refresh / confirm races. */
  const pendingMessagesRef = useRef<Record<string, MessageRecord[]>>({});
  const messagesListGenRef = useRef(0);
  const hubMetaRef = useRef<Record<string, { name: string; caseRef: string; caseSub: string; stage: string; type: 'client' | 'system' }>>({});
  const clientsDataRef = useRef<ClientSummary[]>([]);
  const casesDataRef = useRef<CaseSummary[]>([]);
  const advisersDataRef = useRef<AdviserRecord[]>([]);
  /** Newly created clients kept until bootstrap/list queries catch up (avoids sync wipe). */
  const pendingCreatedClientsRef = useRef<ClientSummary[]>([]);
  const clientsLoadingRef = useRef(false);
  const casesLoadingRef = useRef(false);
  const unreadMessagesCountRef = useRef(0);
  const hasMessagesRef = useRef(true);
  const hasAiReportsRef = useRef(true);
  const showEmbeddedPanel = isEmbeddedPanelTab(activeTab);
  const queryClient = useQueryClient();

  const writeTabHref = useCallback(
    (href: string, tabKey: DemoTab | 'compliance', options?: { replace?: boolean }) => {
      const currentHref =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : locationHref(pathname, new URLSearchParams(searchParams.toString()));
      if (href === currentHref) return;

      pendingTabUrlRef.current = tabKey;
      // Same-route `router.push(?tab=)` soft-nav often stalls on this dashboard and
      // leaves the address bar stuck. History API updates immediately; popstate +
      // location reads keep React in sync without double history entries.
      if (typeof window === 'undefined') return;
      if (options?.replace) window.history.replaceState(window.history.state, '', href);
      else window.history.pushState(window.history.state, '', href);
    },
    [pathname, searchParams],
  );

  const selectTab = useCallback(
    (tab: DemoTab, options?: { replace?: boolean }) => {
      setActiveTab(tab);
      if (tab === 'settings') setSettingsMounted(true);
      if (tab === 'calculator') setCalculatorMounted(true);

      const params = readLocationSearchParams(searchParams);
      const tabParam = demoTabToParam(tab);
      if (tabParam) params.set('tab', tabParam);
      else params.delete('tab');

      writeTabHref(locationHref(pathname, params), tab, options);
    },
    [pathname, searchParams, writeTabHref],
  );

  const applyTabFromLocation = useCallback(() => {
    const sp = readLocationSearchParams(searchParams);
    const raw = sp.get('tab');
    if (raw === 'compliance') {
      pendingTabUrlRef.current = null;
      // Iframe-only section: restore iframe tab without flipping parent to Settings/Calculator.
      setActiveTab((prev) => (isEmbeddedPanelTab(prev) ? 'overview' : prev));
      skipNextIframeTabSyncRef.current = true;
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'ko:switch-tab', tab: 'compliance' },
        window.location.origin,
      );
      return;
    }
    const next = resolveDemoTabFromSearch(sp);
    if (pendingTabUrlRef.current !== null) {
      const pending = pendingTabUrlRef.current;
      if (pending !== 'compliance' && next === pending) {
        pendingTabUrlRef.current = null;
      } else if (searchParams.get('tab') !== raw) {
        // Next soft-nav still on the old ?tab= — don't snap activeTab backward.
        return;
      } else {
        pendingTabUrlRef.current = null;
      }
    }
    setActiveTab((prev) => (prev === next ? prev : next));
    if (next === 'settings') setSettingsMounted(true);
    if (next === 'calculator') setCalculatorMounted(true);
  }, [searchParams]);

  // Keep tab state in sync with the URL (reload + browser back/forward).
  useEffect(() => {
    applyTabFromLocation();
  }, [applyTabFromLocation]);

  useEffect(() => {
    const onPopState = () => {
      pendingTabUrlRef.current = null;
      applyTabFromLocation();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyTabFromLocation]);

  useEffect(() => {
    if (activeTab === 'settings') setSettingsMounted(true);
    if (activeTab === 'calculator') setCalculatorMounted(true);
  }, [activeTab]);

  // Idle-warm Settings after first paint so its API routes don't cold-compile with /dashboard.
  useEffect(() => {
    if (!(isDashboard && authLoaded && isSignedIn) || settingsMounted) return;
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setSettingsMounted(true);
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(mount, { timeout: 10000 });
    } else {
      timeoutId = setTimeout(mount, 5000);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [isDashboard, authLoaded, isSignedIn, settingsMounted]);

  useEffect(() => {
    if (!isDashboard && clerkLoaded && isClerkUser) {
      router.replace('/dashboard');
    }
  }, [isDashboard, clerkLoaded, isClerkUser, router]);

  /** Signed-in app at /dashboard — real API data and personalised UI. */
  const isPersonalDashboard = isDashboard && authLoaded && isSignedIn;
  /** Marketing /demo — always mock "Alex" content, never live API. */
  const isMockDemo = !isDashboard;
  const profileInitial = useMemo(() => {
    const source = user?.firstName ?? user?.username ?? demoUsername ?? 'U';
    return source.charAt(0).toUpperCase() || 'U';
  }, [demoUsername, user?.firstName, user?.username]);
  const handleProfileLogout = useCallback(async () => {
    setProfileOpen(false);
    if (isClerkUser) {
      await signOut({ redirectUrl: '/' });
      return;
    }
    clearAuthenticated();
    router.push('/sign-in');
  }, [isClerkUser, router, signOut]);

  const { data: bootstrapData, isLoading: bootstrapLoading, isError: bootstrapError } =
    useDashboardBootstrap({
      enabled: isPersonalDashboard,
    });

  const { data: clientsData, isLoading: clientsLoading } = useClients(LIVE_CLIENTS_QUERY, {
    enabled: isPersonalDashboard && bootstrapError,
  });
  const { data: casesData, isLoading: casesLoading } = useCases(LIVE_CASES_QUERY, {
    enabled: isPersonalDashboard && bootstrapError,
  });
  const { data: advisersData } = useAdvisers({
    enabled: isPersonalDashboard && bootstrapError,
  });
  const { mutateAsync: createClient } = useCreateClient();
  const { mutateAsync: inviteToPortal } = usePortalInvite();
  const { mutateAsync: createCase } = useCreateCase();
  const hasMessages = usePlanFeature('messages');
  const hasAiReports = usePlanFeature('ai_reports');
  const isAdmin = useIsAdmin();
  const { canViewAiSummaries } = useAdviserVisibility();
  const canFetchUnreadNotifs = isPersonalDashboard && hasMessages;
  const clerkEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const { data: unreadMessagesResponse } = useMessages(
    { unreadOnly: true, page: 1, perPage: 50 },
    { enabled: canFetchUnreadNotifs },
  );
  const { mutateAsync: markMessageRead, isPending: markingNotifsRead } = useMarkMessageRead();

  hasMessagesRef.current = hasMessages;
  hasAiReportsRef.current = hasAiReports && canViewAiSummaries;
  unreadMessagesCountRef.current = !hasMessages
    ? 0
    : (unreadMessagesResponse?.meta?.total ?? unreadMessagesResponse?.data?.length ?? 0);

  {
    const baseClients = isPersonalDashboard
      ? (bootstrapData?.data.clients ?? clientsData?.data ?? [])
      : (clientsData?.data ?? []);
    const pending = pendingCreatedClientsRef.current;
    if (pending.length > 0) {
      const idsInBase = new Set(baseClients.map((c) => c.id));
      pendingCreatedClientsRef.current = pending.filter((c) => !idsInBase.has(c.id));
      const stillPending = pendingCreatedClientsRef.current;
      clientsDataRef.current =
        stillPending.length > 0
          ? [
              ...stillPending,
              ...baseClients.filter((c) => !stillPending.some((p) => p.id === c.id)),
            ]
          : baseClients;
    } else {
      clientsDataRef.current = baseClients;
    }
  }
  casesDataRef.current = isPersonalDashboard
    ? (bootstrapData?.data.cases ?? casesData?.data ?? [])
    : (casesData?.data ?? []);
  advisersDataRef.current = isPersonalDashboard
    ? (bootstrapData?.data.advisers ?? advisersData?.data ?? [])
    : (advisersData?.data ?? []);
  // Only treat as "loading" when we have nothing to show yet (cached data paints instantly).
  const hasLiveListData =
    clientsDataRef.current.length > 0 || casesDataRef.current.length > 0;
  clientsLoadingRef.current = isPersonalDashboard
    ? (bootstrapError ? clientsLoading : bootstrapLoading) && !hasLiveListData
    : clientsLoading && clientsDataRef.current.length === 0;
  casesLoadingRef.current = isPersonalDashboard
    ? (bootstrapError ? casesLoading : bootstrapLoading) && !hasLiveListData
    : casesLoading && casesDataRef.current.length === 0;

  const liveUnreadNotifMessages = useMemo(() => {
    const rows = (unreadMessagesResponse?.data ?? []) as MessageWithContext[];
    return rows.filter((m) => m.direction === 'INBOUND' || m.direction === 'SYSTEM');
  }, [unreadMessagesResponse?.data]);

  const notificationItems = useMemo((): NotificationItem[] => {
    if (!isPersonalDashboard) {
      return DEMO_NOTIFICATIONS.filter((n) => demoUnreadNotifIds.includes(n.id)).map((n) => ({
        ...n,
      }));
    }
    if (!hasMessages) return [];

    return liveUnreadNotifMessages.map((message, index) => {
      const caseFromRef = message.caseId
        ? casesDataRef.current.find((c) => c.id === message.caseId)
        : undefined;
      const clientFromRef = message.clientId
        ? clientsDataRef.current.find((c) => c.id === message.clientId)
        : caseFromRef?.client;

      const clientFields = message.client
        ? {
            firstName: message.client.firstName ?? '',
            lastName: message.client.lastName ?? '',
            companyName: message.client.companyName,
            clientType: message.client.clientType,
          }
        : clientFromRef
          ? {
              firstName: clientFromRef.firstName,
              lastName: clientFromRef.lastName,
              companyName: clientFromRef.companyName,
              clientType: clientFromRef.clientType,
            }
          : null;

      const name =
        message.direction === 'SYSTEM'
          ? 'System'
          : clientFields
            ? formatClientName(clientFields)
            : 'Client';
      const initials =
        message.direction === 'SYSTEM'
          ? 'S'
          : clientFields
            ? formatClientInitials(clientFields)
            : 'CL';
      const caseRef =
        message.case?.referenceNumber ?? caseFromRef?.referenceNumber;
      const bodyPreview = message.body.replace(/\s+/g, ' ').trim();
      const preview = caseRef
        ? `${bodyPreview.slice(0, 72)}${bodyPreview.length > 72 ? '…' : ''} · ${caseRef}`
        : bodyPreview.slice(0, 90) + (bodyPreview.length > 90 ? '…' : '');

      return {
        id: message.id,
        initials,
        name,
        preview: message.subject?.trim() || preview || 'New message',
        time: formatNotifRelativeTime(message.createdAt),
        color: NOTIF_AVATAR_COLORS[index % NOTIF_AVATAR_COLORS.length],
        caseId: message.caseId,
      };
    });
  }, [demoUnreadNotifIds, hasMessages, isPersonalDashboard, liveUnreadNotifMessages]);

  const notifUnread = notificationItems.length;

  const handleMarkAllNotifsRead = useCallback(async () => {
    if (!isPersonalDashboard) {
      setDemoUnreadNotifIds([]);
      return;
    }
    const ids = liveUnreadNotifMessages.map((message) => message.id);
    if (!ids.length) return;
    setMarkingAllNotifs(true);
    applyMessagesReadToCache(queryClient, ids);
    try {
      const token = await getToken();
      if (!token) return;
      await Promise.allSettled(ids.map((id) => messagesApi.markRead(token, id)));
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      setMarkingAllNotifs(false);
    }
  }, [getToken, isPersonalDashboard, liveUnreadNotifMessages, queryClient]);

  const handleNotifItemClick = useCallback(
    async (item: NotificationItem) => {
      setNotifOpen(false);
      selectTab('messages');
      if (!isPersonalDashboard) {
        setDemoUnreadNotifIds((prev) => prev.filter((id) => id !== item.id));
        return;
      }
      if (!item.id.startsWith('demo-')) {
        try {
          await markMessageRead(item.id);
        } catch {
          // Cache rolls back via mutation onError; next poll will resync.
        }
      }
    },
    [isPersonalDashboard, markMessageRead, selectTab],
  );

  const postClientsSync = useCallback((clients?: ClientSummary[]) => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    const list = clients ?? clientsDataRef.current;
    // Never clobber a sessionStorage/iframe paint with [] while bootstrap is still in flight.
    if (list.length === 0 && clientsLoadingRef.current) return;
    iframeWindow.postMessage(
      { type: 'ko:clients-sync', clients: list },
      window.location.origin,
    );
  }, []);

  const postCasesSync = useCallback((cases?: CaseSummary[]) => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    const list = cases ?? casesDataRef.current;
    if (list.length === 0 && casesLoadingRef.current) return;
    iframeWindow.postMessage(
      { type: 'ko:cases-sync', cases: list },
      window.location.origin,
    );
  }, []);

  const postAdvisersSync = useCallback((advisers?: AdviserRecord[]) => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    const source = advisers ?? advisersDataRef.current;
    // Non-admins only see themselves in Add Client / adviser filters.
    const scoped = isAdmin
      ? source
      : source.filter((a) => a.email.toLowerCase() === clerkEmail);
    const self = scoped[0];
    const selfMemberId = self?.memberId ?? self?.id ?? '';
    iframeWindow.postMessage(
      {
        type: 'ko:advisers-sync',
        advisers: scoped.map((a) => ({
          ...a,
          // Prefer OrganisationMember id for assignedMemberId payloads.
          id: a.memberId ?? a.id,
          memberId: a.memberId ?? a.id,
        })),
        lockToSelf: !isAdmin,
        selfMemberId,
      },
      window.location.origin,
    );
  }, [clerkEmail, isAdmin]);

  const syncLiveDataToIframe = useCallback(() => {
    postClientsSync();
    postCasesSync();
    postAdvisersSync();
  }, [postClientsSync, postCasesSync, postAdvisersSync]);

  const renderPersonalOverviewSections = useCallback((idoc: Document) => {
    if (!isPersonalDashboard) return;
    const root = idoc.querySelector<HTMLElement>('#tab-overview .ov-overview-sections');
    if (!root) return;

    root.querySelectorAll('.ko-ov-live-block').forEach((el) => el.remove());

    if (clientsDataRef.current.length === 0) return;

    const cases = casesDataRef.current;
    type StageKey = 'lead' | 'factfind' | 'research' | 'application' | 'completion';
    const stageMap: Record<string, StageKey> = {
      ENQUIRY: 'lead',
      FACT_FIND: 'factfind',
      RESEARCH: 'research',
      DIP: 'application',
      OFFER: 'completion',
      COMPLETION: 'completion',
    };
    const stageLabel: Record<StageKey, string> = {
      lead: 'Enquiry',
      factfind: 'Fact-Find',
      research: 'Research',
      application: 'Application',
      completion: 'Offer',
    };
    const stageTone: Record<StageKey, string> = {
      lead: 'lead',
      factfind: 'factfind',
      research: 'research',
      application: 'application',
      completion: 'completion',
    };
    const byStage: Record<StageKey, CaseSummary[]> = {
      lead: [], factfind: [], research: [], application: [], completion: [],
    };
    cases.forEach((c) => {
      const mapped = stageMap[c.stage] ?? 'lead';
      byStage[mapped].push(c);
    });
    const fmtMoney = (n: number) => `£${n.toLocaleString('en-GB')}`;
    const stageValue = (items: CaseSummary[]) => fmtMoney(items.reduce((sum, c) => sum + (c.loanAmount ?? 0), 0));

    const pipelineBlock = idoc.createElement('div');
    pipelineBlock.className = 'ov-glass-block ko-ov-live-block';
    pipelineBlock.innerHTML = `<div class="ov-pipeline-head">
      <div class="ov-pipeline-head-text">
        <h3 class="ov-pipeline-title">Pipeline at a glance</h3>
        <p class="ov-pipeline-sub">Volume and value by stage</p>
      </div>
      <button type="button" class="ov-pipeline-action" onclick="showTab('cases')" aria-label="View cases">
        <span>View Cases</span>
        <span class="ov-pipeline-action-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#18181b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span>
      </button>
    </div>`;
    const kanbanSection = idoc.createElement('div');
    kanbanSection.className = 'ov-kanban-section';
    const board = idoc.createElement('div');
    board.className = 'kanban ov-pb-board';
    const summaryRow = idoc.createElement('div');
    summaryRow.className = 'ov-pb-summary-row';
    const kanbanRow = idoc.createElement('div');
    kanbanRow.className = 'ov-pb-kanban-row';

    (Object.keys(byStage) as StageKey[]).forEach((stage) => {
      const items = byStage[stage];
      const summary = idoc.createElement('div');
      summary.className = 'ov-pb-summary-card';
      summary.innerHTML = `<h4 class="ov-pb-tab ov-pb-tab--${stageTone[stage]}">${stageLabel[stage]}</h4>
        <div class="ov-pb-stats"><div class="ov-stage-count">${items.length}</div><div class="ov-pb-val ov-pb-val--${stageTone[stage]}">${stageValue(items)}</div></div>`;
      summaryRow.appendChild(summary);

      const col = idoc.createElement('div');
      col.className = `ov-pb-kanban-col ov-pb-kanban-col--${stageTone[stage]}`;
      const cardsWrap = idoc.createElement('div');
      cardsWrap.className = 'ov-pb-cards';
      if (!items.length) {
        cardsWrap.innerHTML = `<div class="kb-card ov-kbcard" style="cursor:default;opacity:.86"><div><div class="kb-card-name">No cases yet</div><div class="kb-cc-ref">Create a case to populate this stage</div></div></div>`;
      } else {
        cardsWrap.innerHTML = items.slice(0, 3).map((c) => {
          const clientName = `${c.client.firstName} ${c.client.lastName}`;
          const amount = fmtMoney(c.loanAmount ?? 0);
          const initials = `${c.client.firstName[0] ?? ''}${c.client.lastName[0] ?? ''}`.toUpperCase();
          return `<div class="kb-card ov-kbcard" onclick="openLiveCase('${c.id}')">
            <div class="kb-cc-top"><div class="kb-cc-avatar">${initials}</div></div>
            <div><div class="kb-card-name">${clientName}</div><div class="kb-cc-ref">${c.referenceNumber}</div></div>
            <div class="kb-cc-tags"><span class="kb-cc-tag">${c.type.replace(/_/g, ' ')}</span><span class="kb-cc-tag">LTV ${c.ltv}%</span></div>
            <div class="kb-cc-amt kb-cc-amt--${stageTone[stage]}">${amount}</div>
          </div>`;
        }).join('');
      }
      col.appendChild(cardsWrap);
      kanbanRow.appendChild(col);
    });

    board.appendChild(summaryRow);
    board.appendChild(kanbanRow);
    kanbanSection.appendChild(board);
    pipelineBlock.appendChild(kanbanSection);
    root.appendChild(pipelineBlock);

    const bottom = idoc.createElement('div');
    bottom.className = 'ov-bottom-row ko-ov-live-block';
    const recent = cases
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
    bottom.innerHTML = `<div class="ov-activity-panel">
      <h3 class="ov-activity-title">Recent activity</h3>
      <div class="ov-activity-list">
        ${recent.length ? recent.map((c, idx) => `<div class="ov-activity-card" onclick="openLiveCase('${c.id}')">
          <div class="ov-activity-left">
            <span class="ov-activity-dot ${idx % 3 === 0 ? 'ov-activity-dot--blue' : idx % 3 === 1 ? 'ov-activity-dot--orange' : 'ov-activity-dot--green'}" aria-hidden="true"></span>
            <div class="ov-activity-copy">
              <p class="ov-activity-name">${c.client.firstName} ${c.client.lastName}</p>
              <p class="ov-activity-ref">${c.referenceNumber}</p>
            </div>
          </div>
          <span class="ov-activity-amt">${fmtMoney(c.loanAmount ?? 0)}</span>
        </div>`).join('') : `<div class="ov-activity-card" style="cursor:default"><div class="ov-activity-left"><div class="ov-activity-copy"><p class="ov-activity-name">No recent case activity</p><p class="ov-activity-ref">Create or update a case to see activity here.</p></div></div><span class="ov-activity-amt">—</span></div>`}
      </div>
    </div>
    <div class="ov-activity-panel">
      <h3 class="ov-activity-title">Quick actions</h3>
      <div class="ov-activity-list">
        <div class="ov-activity-card" onclick="showTab('clients')"><div class="ov-activity-left"><div class="ov-activity-copy"><p class="ov-activity-name">Add or manage clients</p><p class="ov-activity-ref">Keep your CRM current</p></div></div><span class="ov-activity-amt">↗</span></div>
        <div class="ov-activity-card" onclick="showTab('cases')"><div class="ov-activity-left"><div class="ov-activity-copy"><p class="ov-activity-name">Open your case pipeline</p><p class="ov-activity-ref">Track stages and values</p></div></div><span class="ov-activity-amt">↗</span></div>
        <div class="ov-activity-card" onclick="showTab('messages')"><div class="ov-activity-left"><div class="ov-activity-copy"><p class="ov-activity-name">Review client messages</p><p class="ov-activity-ref">Unread and action-required items</p></div></div><span class="ov-activity-amt">↗</span></div>
      </div>
    </div>`;
    root.appendChild(bottom);

    const iwin = idoc.defaultView as Window & { koRefreshOverviewMobilePipeline?: () => void };
    iwin?.koRefreshOverviewMobilePipeline?.();
  }, [isPersonalDashboard]);

  const postOverviewStats = useCallback(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;

    const clientCount = clientsDataRef.current.length;
    const caseCount = casesDataRef.current.length;
    const stillLoading = clientsLoadingRef.current || casesLoadingRef.current;
    const isEmpty = clientCount === 0 && caseCount === 0;

    if (stillLoading && isEmpty) {
      // Keep prior content if any; do not blank KPIs to "…"
      return;
    }

    const pipelineValue = casesDataRef.current.reduce(
      (sum, c) => sum + (Number(c.loanAmount) || 0),
      0,
    );

    iframeWindow.postMessage(
      { type: 'ko:overview-empty', empty: isEmpty },
      window.location.origin,
    );

    if (!isEmpty) {
      iframeWindow.postMessage(
        {
          type: 'ko:overview-stats',
          stats: {
            clients: clientCount,
            cases: caseCount,
            pipelineValue: `£${pipelineValue.toLocaleString('en-GB')}`,
            unreadMessages: unreadMessagesCountRef.current,
          },
        },
        window.location.origin,
      );
    }
    const idoc = iframeRef.current?.contentDocument;
    if (idoc) renderPersonalOverviewSections(idoc);
  }, [renderPersonalOverviewSections]);

  // Start iframe as soon as Clerk auth is ready (don't wait for full user profile hydration).
  const overviewReady = !isDashboard || (authLoaded && isSignedIn);

  const displayName = useMemo(() => {
    if (isMockDemo) return 'Alex';
    return resolveClerkDisplayName(user) ?? 'there';
  }, [isMockDemo, user]);

  const preparePersonalDashboardIframe = useCallback(
    (idoc: Document) => {
      if (!isPersonalDashboard) return;
      const overview = idoc.getElementById('tab-overview');
      overview?.classList.add('ov-personal-mode');

      const snapshot = readDashboardBootstrapSnapshot();
      // Prefer live React Query / placeholder refs; fall back to session snapshot.
      if (clientsDataRef.current.length === 0 && snapshot?.clients?.length) {
        clientsDataRef.current = snapshot.clients;
      }
      if (casesDataRef.current.length === 0 && snapshot?.cases?.length) {
        casesDataRef.current = snapshot.cases;
      }
      if (advisersDataRef.current.length === 0 && snapshot?.advisers?.length) {
        advisersDataRef.current = snapshot.advisers;
      }

      const clients = clientsDataRef.current;
      const cases = casesDataRef.current;
      const hasData = clients.length > 0 || cases.length > 0;

      if (hasData) {
        // Instant paint — do not force empty/loading state.
        overview?.classList.remove('ov-empty-mode');
        const pipelineValue = cases.reduce(
          (sum, c) => sum + (Number(c.loanAmount) || 0),
          0,
        );
        const iwin = idoc.defaultView as Window & {
          koSetOverviewEmpty?: (empty: boolean) => void;
          koSetOverviewStats?: (stats: Record<string, unknown>) => void;
          koRenderLiveOverviewPipeline?: (cases: unknown[]) => void;
          koRenderCases?: (cases: unknown[]) => void;
          koRenderClientsTable?: (clients: unknown[]) => void;
        };
        iwin.koSetOverviewEmpty?.(false);
        iwin.koSetOverviewStats?.({
          clients: clients.length,
          cases: cases.length,
          pipelineValue: `£${pipelineValue.toLocaleString('en-GB')}`,
          unreadMessages: unreadMessagesCountRef.current,
        });
        iwin.koRenderLiveOverviewPipeline?.(cases);
        iwin.koRenderCases?.(cases);
        iwin.koRenderClientsTable?.(clients);
      } else if (!clientsLoadingRef.current && !casesLoadingRef.current) {
        // Confirmed empty org — show zeros. While loading, leave iframe self-hydrate alone.
        overview?.classList.add('ov-empty-mode');
        const emptyVals = idoc.querySelectorAll('#tab-overview [data-ov-kpi-val]');
        emptyVals.forEach((el, index) => {
          el.textContent = index === 2 ? '£0' : '0';
        });
      }

      if (displayName) applyGreetingToIframe(idoc, displayName);
      // Strip prototype demo AI rows immediately so advisers never see mock clients.
      const tbody = idoc.getElementById('ai-rpt-table-body');
      if (tbody) {
        tbody.innerHTML =
          '<tr class="ai-rpt-empty-row"><td colspan="6">Loading reports…</td></tr>';
      }
      const subtitle = idoc.getElementById('ai-rpt-subtitle');
      const statTotal = idoc.getElementById('ai-rpt-stat-total');
      const statFlags = idoc.getElementById('ai-rpt-stat-flags');
      if (subtitle) subtitle.textContent = '0 of 0 clients';
      if (statTotal) statTotal.textContent = '0';
      if (statFlags) statFlags.textContent = '0';
      clearMessagesHubDemo(idoc);
    },
    [displayName, isPersonalDashboard],
  );

  const iframeSrc = useMemo(() => {
    if (!overviewReady) return null;
    const params = new URLSearchParams({ embedded: '1' });
    // Personal dashboard: live API + personalised header (no mock Alex).
    // Greeting is applied via postMessage / applyGreetingToIframe so src stays stable
    // across Clerk hydration and tab switches (avoids full iframe reloads).
    if (isPersonalDashboard) {
      params.set('liveData', '1');
      params.set('personal', '1');
      params.set('tab', initialIframeTabRef.current);
      // Iframe hydrates from sessionStorage / parent sync — avoid locking into empty shell.
      // Do not depend on activeTab — Settings/Calculator must not rebuild this URL.
    } else {
      params.set('tab', demoTabToIframeParam(activeTab));
      if (isMockDemo) params.set('userName', 'Alex');
    }
    return `/live-demo-prototype-v2a.html?${params}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- personal src intentionally ignores activeTab
  }, [isPersonalDashboard ? 'overview' : activeTab, overviewReady, isPersonalDashboard, isMockDemo]);

  const postPersonalGreeting = useCallback(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow || !isPersonalDashboard || !displayName) return;
    iframeWindow.postMessage(
      { type: 'ko:user-greeting', name: displayName },
      window.location.origin,
    );
    const doc = iframeRef.current?.contentWindow?.document;
    if (doc) applyGreetingToIframe(doc, displayName);
  }, [isPersonalDashboard, displayName]);

  useEffect(() => {
    setDemoUsername(getSessionUsername());
  }, []);

  // Only reset load state when the iframe document URL changes — not when
  // switching to/from Settings/Calculator (iframe stays mounted and hidden).
  useEffect(() => {
    setIframeLoaded(false);
  }, [iframeSrc]);

  // Fallback: if onLoad never fires (hydration edge-case, browser quirk, strict-mode remount),
  // force the iframe visible after 6 s so the demo is never permanently stuck loading.
  useEffect(() => {
    if (iframeLoaded || !iframeSrc || showEmbeddedPanel) return;
    const timer = window.setTimeout(() => setIframeLoaded(true), 6000);
    return () => window.clearTimeout(timer);
  }, [iframeLoaded, iframeSrc, showEmbeddedPanel]);

  useEffect(() => {
    if (showEmbeddedPanel || !iframeLoaded) return;

    const sizeFactFindFrame = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      window.scrollTo(0, 0);
      const top = Math.max(0, Math.round(iframe.getBoundingClientRect().top));
      const next = Math.max(window.innerHeight - top, 480);
      setFrameHeight((prev) => (next !== prev ? next : prev));
    };

    const syncHeight = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      if (factFindOpen) {
        sizeFactFindFrame();
        return;
      }
      try {
        const doc = iframe.contentWindow?.document;
        if (!doc) return;
        const bodyHeight = doc.body?.scrollHeight ?? 0;
        const htmlHeight = doc.documentElement?.scrollHeight ?? 0;
        const next = Math.max(bodyHeight, htmlHeight, 1000);
        setFrameHeight((prev) => (next > 0 && next !== prev ? next : prev));
      } catch {
        // same-origin expected; keep fallback on error
      }
    };

    syncHeight();
    const timer = window.setInterval(syncHeight, 400);
    window.addEventListener('resize', syncHeight);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', syncHeight);
    };
  }, [activeTab, iframeLoaded, showEmbeddedPanel, factFindOpen]);

  useEffect(() => {
    if (!factFindOpen) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [factFindOpen]);

  // Personal dashboard: always greet the signed-in user (not mock Alex).
  useEffect(() => {
    if (!iframeLoaded || showEmbeddedPanel || !isPersonalDashboard || !displayName) return;
    postPersonalGreeting();
  }, [iframeLoaded, displayName, showEmbeddedPanel, isPersonalDashboard, postPersonalGreeting]);

  // Intentionally no "loading…" KPI blanking — cached/snapshot data should stay visible.

  const casePrefetchDoneRef = useRef(false);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard) return;
    syncLiveDataToIframe();
    postOverviewStats();
    persistLiveListsSnapshot(
      clientsDataRef.current,
      casesDataRef.current,
      advisersDataRef.current,
    );

    // One-shot warm of recent case details (skip if already cached).
    // Delayed + sequential so cold `/api/cases/[id]` compiles don't stall first paint.
    if (casePrefetchDoneRef.current) return;
    const cases = casesDataRef.current.slice(0, 4);
    if (cases.length === 0) return;
    casePrefetchDoneRef.current = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          casePrefetchDoneRef.current = false;
          return;
        }
        await new Promise((r) => window.setTimeout(r, 2500));
        for (const c of cases) {
          if (queryClient.getQueryData(['cases', c.id])) continue;
          try {
            const result = await casesApi.get(token, c.id);
            queryClient.setQueryData(['cases', c.id], result);
          } catch {
            // best-effort warm
          }
        }
        for (const c of cases.slice(0, 3)) {
          const tlKey = ['cases', c.id, 'timeline'] as const;
          if (queryClient.getQueryData(tlKey)) continue;
          const tl = await casesApi.timeline(token, c.id).catch(() => null);
          if (tl) queryClient.setQueryData(tlKey, tl);
        }
        if (hasMessagesRef.current) {
          for (const c of cases.slice(0, 2)) {
            const key = ['messages', 1, 100, c.id, '', false] as const;
            if (queryClient.getQueryData(key)) continue;
            try {
              const msgs = await messagesApi.list(token, { caseId: c.id, perPage: 100 });
              queryClient.setQueryData(key, msgs);
            } catch {
              // best-effort warm
            }
          }
        }
      } catch {
        casePrefetchDoneRef.current = false;
      }
    })();
  }, [
    iframeLoaded,
    isPersonalDashboard,
    bootstrapLoading,
    clientsLoading,
    casesLoading,
    bootstrapData,
    clientsData,
    casesData,
    advisersData,
    syncLiveDataToIframe,
    postOverviewStats,
    getToken,
    queryClient,
  ]);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard) return;
    postClientsSync();
    postOverviewStats();
  }, [iframeLoaded, isPersonalDashboard, clientsData, clientsLoading, postClientsSync, postOverviewStats]);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard) return;
    postCasesSync();
    postOverviewStats();
  }, [iframeLoaded, isPersonalDashboard, casesData, casesLoading, postCasesSync, postOverviewStats]);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard) return;
    postAdvisersSync();
  }, [iframeLoaded, isPersonalDashboard, advisersData, bootstrapData, isAdmin, clerkEmail, postAdvisersSync]);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard) return;
    postOverviewStats();
  }, [
    iframeLoaded,
    isPersonalDashboard,
    hasMessages,
    unreadMessagesResponse,
    postOverviewStats,
  ]);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard || !hasMessages) return;

    const refreshOpenSurfaces = () => {
      const idoc = iframeRef.current?.contentDocument;
      if (!idoc || showEmbeddedPanel) return;

      if (activeTab === 'messages') {
        void refreshMessagesHubFromApi(idoc);
      }

      const caseId = activeCaseIdRef.current;
      if (!caseId) return;
      // Only refresh if the case messages panel is in the DOM (case is open).
      if (!idoc.querySelector(`#caseview-msgs-${caseId}`)) return;

      void (async () => {
        try {
          const token = await getTokenRef.current();
          if (!token) return;
          const gen = ++messagesListGenRef.current;
          const fresh = await messagesApi.list(token, { caseId, perPage: 100 });
          if (gen !== messagesListGenRef.current) return;
          if (activeCaseIdRef.current !== caseId) return;
          const threadKey = threadKeyForCase(caseId);
          hubMessagesRef.current[threadKey] = mergeThreadMessages(threadKey, fresh.data);
          renderMessagesThread(idoc, caseId);
          if (activeTab === 'messages') {
            const openInput = idoc.querySelector<HTMLInputElement>(
              '.msg-hub-composer-input[data-thread-key]',
            );
            const openKey = openInput?.getAttribute('data-thread-key');
            if (openKey === threadKey) {
              renderHubThreadPanel(idoc, openKey);
            }
          }
        } catch {
          // Poll is best-effort.
        }
      })();
    };

    const first = window.setTimeout(refreshOpenSurfaces, 1500);
    const interval = window.setInterval(refreshOpenSurfaces, 8000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [iframeLoaded, isPersonalDashboard, hasMessages, activeTab, showEmbeddedPanel]);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard || showEmbeddedPanel) return;
    if (activeTab === 'clients' || activeTab === 'cases') {
      syncLiveDataToIframe();
    }
    if (activeTab === 'messages') {
      const idoc = iframeRef.current?.contentDocument;
      if (idoc) {
        if (hasMessages) void refreshMessagesHubFromApi(idoc);
        else renderMessagesHubPlanLocked(idoc);
      }
    }
    if (activeTab === 'ai') {
      const idoc = iframeRef.current?.contentDocument;
      if (idoc) void refreshAiHubFromApi(idoc);
    }
    if (skipNextIframeTabSyncRef.current) {
      skipNextIframeTabSyncRef.current = false;
      const painted = initialIframeTabRef.current;
      // Only skip when the iframe already painted the same tab as the URL.
      // If the user switched tabs before load finished, still sync.
      if (
        painted === demoTabToIframeParam(activeTab) ||
        (painted === 'compliance' && activeTab === 'overview')
      ) {
        return;
      }
    }
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'ko:switch-tab', tab: activeTab },
      window.location.origin,
    );
  }, [activeTab, iframeLoaded, isPersonalDashboard, showEmbeddedPanel, syncLiveDataToIframe, hasMessages, hasAiReports]);

  useEffect(() => {
    if (!isDashboard || !isClerkUser) return;

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const iframe = iframeRef.current;
      const iframeWindow = iframe?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;

      const data = event.data as {
        type?: string;
        requestId?: number;
        caseId?: string;
        clientIds?: string[];
        path?: string;
        tab?: string;
        payload?: CreateClientInput | CreateCaseInput | Record<string, unknown>;
        file?: {
          name: string;
          mimeType: string;
          base64: string;
          documentCategory?: string;
        };
      };

      if (data?.type === 'ko:navigate' && typeof data.path === 'string') {
        if (data.path.includes('settings')) {
          selectTab('settings');
          return;
        }
        router.push(data.path);
        return;
      }

      if (data?.type === 'ko:tab-change' && typeof data.tab === 'string') {
        const raw = data.tab;
        if (raw === 'compliance') {
          const params = readLocationSearchParams(searchParams);
          params.set('tab', 'compliance');
          writeTabHref(locationHref(pathname, params), 'compliance');
          return;
        }
        const tab = demoTabFromParam(raw === 'calculators' ? 'calculator' : raw);
        if (tab) selectTab(tab);
        return;
      }

      if (data?.type === 'ko:fact-find-open') {
        setFactFindOpen(true);
        window.scrollTo(0, 0);
        const iframeEl = iframeRef.current;
        if (iframeEl) {
          const top = Math.max(0, Math.round(iframeEl.getBoundingClientRect().top));
          setFrameHeight(Math.max(window.innerHeight - top, 480));
        }
        return;
      }

      if (data?.type === 'ko:fact-find-close') {
        setFactFindOpen(false);
        return;
      }

      if (data?.type === 'ko:request-clients-sync') {
        postClientsSync();
        return;
      }

      if (data?.type === 'ko:request-cases-sync') {
        postCasesSync();
        return;
      }

      if (data?.type === 'ko:request-advisers-sync') {
        postAdvisersSync();
        return;
      }

      if (data?.type === 'ko:open-case' && typeof data.caseId === 'string') {
        const openedCaseId = data.caseId;
        activeCaseIdRef.current = openedCaseId;

        const paintCaseExtras = (
          caseRow: Case | CaseSummary,
          extras: {
            docs?: Array<{
              id: string;
              name: string;
              documentType: string;
              mimeType?: string;
              sizeBytes?: number;
              uploadedBy?: string;
              createdAt: string;
            }>;
            timeline?: TimelineEntry[];
            messages?: MessageRecord[];
            report?: AiReport | null;
            paintDocs?: boolean;
            paintTimeline?: boolean;
            paintMessages?: boolean;
            paintAi?: boolean;
            paintCompliance?: boolean;
          },
        ) => {
          if (activeCaseIdRef.current !== openedCaseId) return;
          const idoc = iframeRef.current?.contentDocument;
          if (!idoc) return;

          if (extras.paintCompliance !== false) {
            updateCompliancePanel(idoc, openedCaseId, caseRow.stage);
          }
          if (extras.paintDocs && extras.docs) {
            renderDocsTable(idoc, extras.docs, openedCaseId);
          }
          if (extras.paintTimeline && extras.timeline) {
            renderTimelineTrack(idoc, extras.timeline);
          }
          if (extras.paintMessages) {
            if (hasMessagesRef.current) {
              renderMessagesThread(idoc, openedCaseId, extras.messages ?? []);
            } else {
              renderMessagesPlanLocked(idoc, openedCaseId);
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const iwin = iframeRef.current?.contentWindow as any;
          if (iwin) hookAiReportHandlers(iwin);

          if (extras.paintAi) {
            if (!hasAiReportsRef.current) {
              renderAiReportPlanLocked(idoc, openedCaseId);
            } else if (extras.report) {
              renderAiReportBody(idoc, openedCaseId, extras.report);
            } else {
              const state = iwin?.caseAiReportState?.[openedCaseId];
              if (state) {
                state.checklist = [true, true, true];
                state.template = CASE_TYPE_TO_PROTO_TPL[caseRow.type] ?? 'remortgage';
                state.phase = 'ready';
                iwin?.refreshCaseReportUI?.(openedCaseId);
              }
            }
          }
        };

        const postCaseDetail = (caseRow: Case | CaseSummary) => {
          iframeWindow.postMessage(
            { type: 'ko:case-detail', case: caseRow },
            window.location.origin,
          );
          caseDetailRef.current[openedCaseId] = {
            referenceNumber: caseRow.referenceNumber,
            type: caseRow.type,
            stage: caseRow.stage,
            client: {
              firstName: caseRow.client?.firstName,
              lastName: caseRow.client?.lastName,
            },
            selectedLender: caseRow.selectedLender,
            selectedProduct: caseRow.selectedProduct,
            selectedRate: 'selectedRate' in caseRow ? caseRow.selectedRate : undefined,
            selectedFee: 'selectedFee' in caseRow ? caseRow.selectedFee : undefined,
            adviserNotes: 'adviserNotes' in caseRow ? caseRow.adviserNotes : undefined,
            loanAmount: caseRow.loanAmount,
          };
          // Paint stage/progress rail immediately from list/cache — don't wait on extras.
          const idoc = iframeRef.current?.contentDocument;
          if (idoc) {
            window.setTimeout(() => {
              if (activeCaseIdRef.current !== openedCaseId) return;
              updateCompliancePanel(idoc, openedCaseId, caseRow.stage);
            }, 0);
          }
        };

        try {
          // Start shell from cache before awaiting Clerk token when possible.
          const cachedDetail = queryClient.getQueryData<ApiSuccessResponse<Case>>([
            'cases',
            openedCaseId,
          ]);
          const listHit = casesDataRef.current.find((c) => c.id === openedCaseId);
          const clientHit = listHit
            ? clientsDataRef.current.find((c) => c.id === listHit.clientId)
            : undefined;

          if (cachedDetail?.data) {
            postCaseDetail(cachedDetail.data);
          } else if (listHit) {
            postCaseDetail({
              ...listHit,
              client: {
                ...listHit.client,
                email: clientHit?.email ?? listHit.client.email,
                ...(clientHit
                  ? {
                      employmentStatus: clientHit.employmentStatus,
                    }
                  : {}),
              },
            } as CaseSummary);
          }

          // Instant messages/docs/timeline from cache while network catches up.
          const shellRow = cachedDetail?.data ?? listHit;
          if (shellRow) {
            const cachedMsgs =
              hubMessagesRef.current[`case-${openedCaseId}`] ??
              queryClient.getQueryData<ApiSuccessResponse<MessageRecord[]>>([
                'messages',
                1,
                100,
                openedCaseId,
                '',
                false,
              ])?.data;
            if (cachedMsgs?.length) {
              paintCaseExtras(shellRow, {
                messages: cachedMsgs,
                paintMessages: true,
                paintCompliance: false,
              });
            }
            const cachedTl = queryClient.getQueryData<ApiSuccessResponse<TimelineEntry[]>>([
              'cases',
              openedCaseId,
              'timeline',
            ])?.data;
            if (cachedTl?.length) {
              paintCaseExtras(shellRow, {
                timeline: cachedTl,
                paintTimeline: true,
                paintCompliance: false,
              });
            } else {
              const createdAt =
                'createdAt' in shellRow && typeof shellRow.createdAt === 'string'
                  ? shellRow.createdAt
                  : shellRow.updatedAt;
              if (createdAt) {
                // Provisional "Case created" so Overview isn't stuck on a blank stub.
                paintCaseExtras(shellRow, {
                  timeline: [
                    {
                      id: `local-created-${openedCaseId}`,
                      entityType: 'Case',
                      entityId: openedCaseId,
                      action: 'CASE_CREATED',
                      createdAt,
                    },
                  ],
                  paintTimeline: true,
                  paintCompliance: false,
                });
              }
            }
          }

          const token = await getToken();
          if (!token) throw new Error('Not authenticated');

          // Fetch full case + secondary panels in parallel; paint each as it arrives.
          const casePromise = casesApi.get(token, openedCaseId).then((result) => {
            queryClient.setQueryData(['cases', openedCaseId], result);
            return result;
          });

          const docsPromise = documentsApi
            .list(token, { caseId: openedCaseId, page: 1, perPage: 100 })
            .catch(() => null);
          const tlPromise = casesApi.timeline(token, openedCaseId).then((result) => {
            queryClient.setQueryData(['cases', openedCaseId, 'timeline'], result);
            return result;
          }).catch(() => null);
          const aiPromise = hasAiReportsRef.current
            ? aiApi.listReports(token, { caseId: openedCaseId, perPage: 1 }).catch(() => null)
            : Promise.resolve(null);
          const msgsPromise = hasMessagesRef.current
            ? messagesApi.list(token, { caseId: openedCaseId, perPage: 100 }).catch(() => null)
            : Promise.resolve(null);

          void docsPromise.then((docsResult) => {
            if (activeCaseIdRef.current !== openedCaseId || !docsResult) return;
            const row =
              queryClient.getQueryData<ApiSuccessResponse<Case>>(['cases', openedCaseId])?.data ??
              listHit;
            if (!row) return;
            paintCaseExtras(row, {
              docs: docsResult.data ?? [],
              paintDocs: true,
              paintCompliance: false,
            });
          });

          void tlPromise.then((tlResult) => {
            if (activeCaseIdRef.current !== openedCaseId || !tlResult) return;
            const row =
              queryClient.getQueryData<ApiSuccessResponse<Case>>(['cases', openedCaseId])?.data ??
              listHit;
            if (!row) return;
            paintCaseExtras(row, {
              timeline: tlResult.data ?? [],
              paintTimeline: true,
              paintCompliance: false,
            });
          });

          void msgsPromise.then((msgsResult) => {
            if (activeCaseIdRef.current !== openedCaseId) return;
            const row =
              queryClient.getQueryData<ApiSuccessResponse<Case>>(['cases', openedCaseId])?.data ??
              listHit;
            if (!row) return;
            paintCaseExtras(row, {
              messages: msgsResult?.data ?? [],
              paintMessages: true,
              paintCompliance: false,
            });
          });

          void aiPromise.then((aiResult) => {
            if (activeCaseIdRef.current !== openedCaseId) return;
            const row =
              queryClient.getQueryData<ApiSuccessResponse<Case>>(['cases', openedCaseId])?.data ??
              listHit;
            if (!row) return;
            paintCaseExtras(row, {
              report: aiResult?.data?.[0] ?? null,
              paintAi: true,
              paintCompliance: false,
            });
          });

          const caseResult = await casePromise;
          if (activeCaseIdRef.current !== openedCaseId) return;

          // Refresh with full detail (soft-updates if already open) + correct progress.
          postCaseDetail(caseResult.data);
        } catch (err) {
          iframeWindow.postMessage(
            {
              type: 'ko:open-case-error',
              caseId: openedCaseId,
              error: formatApiError(err, { fallback: 'Failed to load case' }),
            },
            window.location.origin,
          );
        }
        return;
      }

      if (data?.type === 'ko:create-case' && data.requestId != null && data.payload) {
        const casePayload = data.payload as CreateCaseInput;
        const replyCase = (body: Record<string, unknown>) => {
          iframeWindow.postMessage(
            { type: 'ko:create-case-result', requestId: data.requestId, ...body },
            window.location.origin,
          );
        };

        try {
          const result = await createCase(casePayload);
          const created = result.data;
          // Mutation already patched caches; refresh refs immediately for iframe sync.
          applyCreatedCaseToCache(queryClient, created);
          const nextCases = [
            created,
            ...casesDataRef.current.filter((c) => c.id !== created.id),
          ];
          casesDataRef.current = nextCases;
          // Show success immediately — sync lists in the background.
          replyCase({
            success: true,
            case: created,
            clientName: formatClientName(created.client),
          });
          selectTab('cases');
          postCasesSync(nextCases);
          postClientsSync();
        } catch (err) {
          replyCase({ success: false, error: formatApiError(err, { fallback: 'Could not create case. Please try again.' }) });
        }
        return;
      }

      if (data?.type === 'ko:portal-invite' && data.requestId != null && data.caseId) {
        const replyInvite = (body: Record<string, unknown>) => {
          iframeWindow.postMessage(
            { type: 'ko:portal-invite-result', requestId: data.requestId, ...body },
            window.location.origin,
          );
        };

        try {
          const result = await inviteToPortal(String(data.caseId));
          replyInvite({ success: true, message: result.message });
        } catch (err) {
          replyInvite({
            success: false,
            error: formatApiError(err, { fallback: 'Could not send portal invite.' }),
          });
        }
        return;
      }

      if (data?.type === 'ko:delete-clients' && data.requestId != null) {
        const ids = Array.isArray(data.clientIds) ? data.clientIds : [];
        const replyDelete = (body: Record<string, unknown>) => {
          iframeWindow.postMessage(
            { type: 'ko:delete-clients-result', requestId: data.requestId, ...body },
            window.location.origin,
          );
        };

        if (ids.length === 0) {
          replyDelete({ success: false, error: 'No clients selected.' });
          return;
        }

        try {
          const token = await getToken();
          if (!token) throw new Error('Not authenticated');

          const results = await Promise.allSettled(
            ids.map(async (clientId) => clientsApi.delete(token, clientId)),
          );
          const deletedCount = results.filter((result) => result.status === 'fulfilled').length;
          if (deletedCount === 0) {
            replyDelete({ success: false, error: 'Could not delete selected clients.' });
            return;
          }

          applyDeletedClientsToCache(queryClient, ids.filter((_, i) => results[i]?.status === 'fulfilled'));
          softInvalidateDashboardLists(queryClient);
          const bootstrap = queryClient.getQueryData<{
            data: { clients: ClientSummary[]; cases: CaseSummary[] };
          }>(dashboardBootstrapQueryKey);
          const freshClients = queryClient.getQueryData<{ data: ClientSummary[] }>(
            clientsQueryKey(LIVE_CLIENTS_QUERY),
          );
          const freshCases = queryClient.getQueryData<{ data: CaseSummary[] }>(
            casesQueryKey(LIVE_CASES_QUERY),
          );
          clientsDataRef.current = bootstrap?.data.clients ?? freshClients?.data ?? [];
          casesDataRef.current = bootstrap?.data.cases ?? freshCases?.data ?? [];
          syncLiveDataToIframe();
          replyDelete({ success: true, deletedCount });
        } catch (err) {
          replyDelete({
            success: false,
            error: formatApiError(err, { fallback: 'Could not delete selected clients.' }),
          });
        }
        return;
      }

      if (data?.type === 'ko:fact-find-save' && data.requestId != null && data.caseId && data.payload) {
        const replyFactFind = (body: Record<string, unknown>) => {
          iframeWindow.postMessage(
            { type: 'ko:fact-find-save-result', requestId: data.requestId, ...body },
            window.location.origin,
          );
        };

        try {
          const token = await getToken();
          if (!token) throw new Error('Not authenticated');
          const { expandFactFindUpsertPayload } = await import('@/lib/fact-find/serializeFactFindForm');
          const payload = expandFactFindUpsertPayload(
            data.payload as UpsertFactFindInput,
          ) as UpsertFactFindInput;
          const saved = await casesApi.upsertFactFind(token, data.caseId, payload);
          replyFactFind({
            success: true,
            factFind: saved.data.factFind,
            client: saved.data.client,
            completed:
              Boolean(saved.data.factFind?.completedAt) || Boolean(payload.markComplete),
          });

          void queryClient.invalidateQueries({ queryKey: casesQueryKey(LIVE_CASES_QUERY) });

          // After final submit, refresh case detail so compliance rail reflects FACT_FIND.
          if (payload.markComplete) {
            try {
              const updated = await casesApi.get(token, data.caseId as string);
              applyUpdatedCaseToCache(queryClient, updated.data);
              softInvalidateDashboardLists(queryClient);
              const bootstrap = queryClient.getQueryData<{
                data: { cases: CaseSummary[] };
              }>(dashboardBootstrapQueryKey);
              if (bootstrap?.data.cases) {
                casesDataRef.current = bootstrap.data.cases;
                syncLiveDataToIframe();
              }
              iframeWindow.postMessage(
                { type: 'ko:case-detail', case: updated.data },
                window.location.origin,
              );
              window.setTimeout(() => {
                const idoc = iframeRef.current?.contentDocument;
                if (idoc) updateCompliancePanel(idoc, data.caseId as string, updated.data.stage);
              }, 80);
            } catch {
              // Non-critical — panel refreshes on next case open.
            }
          }
        } catch (err) {
          replyFactFind({
            success: false,
            error: formatApiError(err, { fallback: 'Could not save fact-find.' }),
          });
        }
        return;
      }

      if (data?.type === 'ko:fact-find-autofill' && data.requestId != null && data.file) {
        const replyAutofill = (body: Record<string, unknown>) => {
          iframeWindow.postMessage(
            { type: 'ko:fact-find-autofill-result', requestId: data.requestId, ...body },
            window.location.origin,
          );
        };

        try {
          const token = await getToken();
          if (!token) throw new Error('Not authenticated');

          const filePayload = data.file as {
            name: string;
            mimeType: string;
            base64: string;
            documentCategory?: string;
          };
          const binary = atob(filePayload.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          const file = new File([bytes], filePayload.name, { type: filePayload.mimeType });

          const result = await aiApi.extractFactFind(token, {
            file,
            caseId: typeof data.caseId === 'string' ? data.caseId : undefined,
            documentCategory: filePayload.documentCategory,
          });

          replyAutofill({
            success: true,
            extracted: result.data.extracted,
            fieldsFound: result.data.fieldsFound,
          });
        } catch (err) {
          replyAutofill({
            success: false,
            error: formatApiError(err, {
              fallback: 'Document auto-fill unavailable. Please continue manually.',
            }),
          });
        }
        return;
      }

      if (data?.type !== 'ko:create-client' || data.requestId == null || !data.payload) return;

      const reply = (body: Record<string, unknown>) => {
        iframeWindow.postMessage(
          { type: 'ko:create-client-result', requestId: data.requestId, ...body },
          window.location.origin,
        );
      };

      try {
        const payload = data.payload as CreateClientInput;
        const result = await createClient(payload);
        const created = result.data;
        const assignedId = payload.assignedMemberId;
        const adviser = assignedId
          ? advisersDataRef.current.find(
              (a) => a.id === assignedId || a.memberId === assignedId,
            )
          : undefined;
        const fullClient: ClientSummary = {
          id: created.id,
          referenceNumber: created.referenceNumber,
          clientType: payload.clientType ?? 'INDIVIDUAL',
          companyName: payload.companyName,
          firstName: created.firstName,
          lastName: created.lastName,
          email: created.email,
          employmentStatus: payload.employmentStatus ?? 'EMPLOYED',
          annualIncome: payload.annualIncome,
          isReferred: payload.isReferred ?? false,
          referredToCompany: payload.referredToCompany,
          insurerName: payload.insurerName,
          status: 'PROSPECT',
          isVulnerable: false,
          assignedMember: adviser
            ? {
                id: adviser.memberId ?? adviser.id,
                firstName: adviser.firstName ?? '',
                lastName: adviser.lastName ?? '',
              }
            : null,
          _count: { cases: 0, messages: 0 },
        };
        // Ensure bootstrap + lists include the new client before iframe sync.
        applyCreatedClientToCache(queryClient, fullClient);
        pendingCreatedClientsRef.current = [
          fullClient,
          ...pendingCreatedClientsRef.current.filter((c) => c.id !== fullClient.id),
        ];
        const nextClients = [
          fullClient,
          ...clientsDataRef.current.filter((c) => c.id !== fullClient.id),
        ];
        clientsDataRef.current = nextClients;
        persistLiveListsSnapshot(
          nextClients,
          casesDataRef.current,
          advisersDataRef.current,
        );
        selectTab('clients');
        // Explicit list — same pattern as case create sync, avoids stale-ref races.
        postClientsSync(nextClients);
        postAdvisersSync();
        reply({
          success: true,
          client: fullClient,
          welcomeEmail: undefined,
        });
      } catch (err) {
        const fields = getApiErrorFieldMap(err);
        reply({
          success: false,
          error: formatApiError(err, { fallback: 'Something went wrong. Please try again.' }),
          fields,
        });
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isDashboard, isClerkUser, createClient, createCase, inviteToPortal, getToken, syncLiveDataToIframe, postClientsSync, postCasesSync, postAdvisersSync, queryClient, router, selectTab, writeTabHref, pathname, searchParams]);

  // ── Directly update the iframe's documents table ────────────────────────────
  // Works because the iframe is same-origin, so the parent can touch its DOM.
  function renderDocsTable(idoc: Document, docs: { id: string; name: string; documentType: string; mimeType?: string; sizeBytes?: number; uploadedBy?: string; createdAt: string }[], caseId: string) {
    const tbody = idoc.getElementById('cd-docs-table-body');
    if (!tbody) return;
    if (!docs.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="padding:24px;text-align:center;color:#a1a1aa;font-size:13px">No documents uploaded yet</td></tr>';
      wireDocsToolbarActions(idoc, caseId, docs);
      return;
    }
    tbody.innerHTML = docs.map(doc => {
      const raw = doc.mimeType ?? '';
      const ext = raw.includes('pdf') ? 'pdf'
        : raw.includes('png') ? 'png'
        : (raw.includes('jpeg') || raw.includes('jpg')) ? 'jpg'
        : (raw.includes('word') || raw.includes('docx')) ? 'doc'
        : (raw.includes('excel') || raw.includes('xlsx')) ? 'xls'
        : (raw.split('/')[1]?.split(';')[0] || 'file');
      const date = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-GB') : '—';
      const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `<tr class="cd-docs-row" data-cd-doc-row data-doc-id="${esc(doc.id)}" data-doc-type="${esc(doc.documentType)}" data-doc-ext="${esc(ext)}" data-doc-name="${esc(doc.name)}" data-doc-uploaded-by="${esc(doc.uploadedBy ?? '—')}" data-doc-date="${esc(date)}">
        <td class="cd-docs-col-check"><input type="checkbox" class="cd-docs-checkbox cd-docs-row-cb" aria-label="Select ${esc(doc.name)}"></td>
        <td><div class="cd-doc-name">${esc(doc.name)}</div><div class="cd-doc-email">${esc(doc.documentType)}</div></td>
        <td class="cd-doc-cell-muted">${esc(doc.documentType)}</td>
        <td><span class="cd-file-pill cd-file-pill--${esc(ext)}">${esc(ext)}</span></td>
        <td class="cd-doc-cell-muted">${esc(doc.uploadedBy ?? '—')}</td>
        <td class="cd-doc-cell-muted">${date}</td>
        <td><span class="cd-doc-status cd-doc-status--active"><span class="cd-doc-status-dot"></span>Active</span></td>
      </tr>`;
    }).join('');
    wireDocsToolbarActions(idoc, caseId, docs);
  }

  function wireDocsToolbarActions(
    idoc: Document,
    caseId: string,
    docs: { id: string; name: string; documentType: string; mimeType?: string; sizeBytes?: number; uploadedBy?: string; createdAt: string }[],
  ) {
    const root = idoc.getElementById('tab-case-detail');
    if (!root) return;
    const search = root.querySelector<HTMLInputElement>('#cd-docs-search');
    const selectAll = root.querySelector<HTMLInputElement>('#cd-docs-select-all');
    const toolbarButtons = root.querySelectorAll<HTMLButtonElement>('.cd-docs-actions .cd-docs-tool-btn');
    if (!search || !selectAll || toolbarButtons.length < 3) return;
    const [deleteBtn, filterBtn, exportBtn] = Array.from(toolbarButtons);

    let filterType = (root.getAttribute('data-ko-doc-filter') || 'ALL').toUpperCase();

    const closeDocsModal = () => {
      idoc.querySelectorAll('.ko-docs-modal-overlay').forEach((el) => el.remove());
    };

    const openInfoModal = (title: string, message: string) => {
      closeDocsModal();
      const overlay = idoc.createElement('div');
      overlay.className = 'ko-docs-modal-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.innerHTML = `<div style="width:min(460px,100%);background:#fff;border-radius:14px;padding:20px 20px 16px;box-shadow:0 20px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
        <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#18181b">${title}</h3>
        <p style="margin:0 0 16px;font-size:14px;color:#52525b;line-height:1.5">${message}</p>
        <div style="display:flex;justify-content:flex-end"><button type="button" data-ko-close style="padding:9px 16px;border:1px solid #d4d4d8;border-radius:10px;background:#fff;font-size:13px;cursor:pointer">Close</button></div>
      </div>`;
      idoc.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target === overlay || target.closest('[data-ko-close]')) closeDocsModal();
      });
    };

    const openConfirmDeleteModal = (count: number, onConfirm: () => void) => {
      closeDocsModal();
      const overlay = idoc.createElement('div');
      overlay.className = 'ko-docs-modal-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.innerHTML = `<div style="width:min(460px,100%);background:#fff;border-radius:14px;padding:20px 20px 16px;box-shadow:0 20px 40px rgba(0,0,0,.25);font-family:'DM Sans',sans-serif">
        <h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#18181b">Delete documents</h3>
        <p style="margin:0 0 16px;font-size:14px;color:#52525b;line-height:1.5">Delete ${count} selected document${count > 1 ? 's' : ''}? This action cannot be undone.</p>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button type="button" data-ko-cancel style="padding:9px 16px;border:1px solid #d4d4d8;border-radius:10px;background:#fff;font-size:13px;cursor:pointer">Cancel</button>
          <button type="button" data-ko-confirm style="padding:9px 16px;border:none;border-radius:10px;background:#e11d48;color:#fff;font-size:13px;cursor:pointer">Delete</button>
        </div>
      </div>`;
      idoc.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target === overlay || target.closest('[data-ko-cancel]')) closeDocsModal();
        if (target.closest('[data-ko-confirm]')) {
          closeDocsModal();
          onConfirm();
        }
      });
    };

    const closeDocsFilterPanel = () => {
      idoc.getElementById('ko-doc-filter-panel')?.remove();
    };

    const openDocsFilterPanel = (types: string[]) => {
      closeDocsFilterPanel();
      const rect = filterBtn.getBoundingClientRect();
      const panel = idoc.createElement('div');
      panel.id = 'ko-doc-filter-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Filter documents');
      panel.style.cssText = `position:fixed;top:${Math.round(rect.bottom + 8)}px;left:${Math.round(rect.right - 280)}px;z-index:9999;width:280px;padding:16px;border:1px solid #e4e4e7;border-radius:12px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.1);display:flex;flex-direction:column;gap:14px;font-family:'DM Sans',sans-serif`;
      panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#18181b">Filters</span>
        <button type="button" id="ko-doc-filter-clear" style="border:none;background:none;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;color:#0F6E56;cursor:pointer;padding:0">Clear all</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <label for="ko-doc-filter-type" style="font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.04em">Type</label>
        <select id="ko-doc-filter-type" style="width:100%;padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;color:#18181b;background:#fff;outline:none;cursor:pointer">
          ${types.map((t) => `<option value="${t}" ${t === filterType ? 'selected' : ''}>${t === 'ALL' ? 'All types' : t}</option>`).join('')}
        </select>
      </div>
      <button type="button" id="ko-doc-filter-apply" style="width:100%;padding:9px 14px;border:none;border-radius:8px;background:#0F6E56;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer">Apply filters</button>`;
      idoc.body.appendChild(panel);

      const clearBtn = panel.querySelector<HTMLButtonElement>('#ko-doc-filter-clear');
      const applyBtn = panel.querySelector<HTMLButtonElement>('#ko-doc-filter-apply');
      const typeSelect = panel.querySelector<HTMLSelectElement>('#ko-doc-filter-type');
      if (clearBtn && typeSelect) {
        clearBtn.onclick = () => {
          typeSelect.value = 'ALL';
          filterType = 'ALL';
          root.setAttribute('data-ko-doc-filter', filterType);
          applyFilters();
        };
      }
      if (applyBtn && typeSelect) {
        applyBtn.onclick = () => {
          filterType = (typeSelect.value || 'ALL').toUpperCase();
          root.setAttribute('data-ko-doc-filter', filterType);
          applyFilters();
          closeDocsFilterPanel();
        };
      }

      const onOutside = (ev: MouseEvent) => {
        const target = ev.target as HTMLElement | null;
        if (!target) return;
        if (panel.contains(target) || filterBtn.contains(target)) return;
        closeDocsFilterPanel();
        idoc.removeEventListener('mousedown', onOutside, true);
      };
      idoc.addEventListener('mousedown', onOutside, true);
    };

    const applyFilters = () => {
      const q = search.value.trim().toLowerCase();
      root.querySelectorAll<HTMLTableRowElement>('[data-cd-doc-row]').forEach((tr) => {
        const text = (tr.textContent || '').toLowerCase();
        const type = (tr.getAttribute('data-doc-type') || '').toUpperCase();
        const typeMatch = filterType === 'ALL' || type === filterType;
        const qMatch = !q || text.includes(q);
        tr.style.display = typeMatch && qMatch ? '' : 'none';
        const cb = tr.querySelector<HTMLInputElement>('.cd-docs-row-cb');
        if (cb && tr.style.display === 'none') cb.checked = false;
      });
      const visibleCbs = Array.from(root.querySelectorAll<HTMLInputElement>('.cd-docs-row-cb'))
        .filter((cb) => cb.closest('tr')?.style.display !== 'none');
      const selected = visibleCbs.filter((cb) => cb.checked).length;
      selectAll.checked = visibleCbs.length > 0 && selected === visibleCbs.length;
      selectAll.indeterminate = selected > 0 && selected < visibleCbs.length;
      filterBtn.textContent = filterType === 'ALL' ? 'Filters' : `Filters: ${filterType}`;
    };

    search.oninput = applyFilters;
    selectAll.onchange = () => {
      root.querySelectorAll<HTMLInputElement>('.cd-docs-row-cb').forEach((cb) => {
        const tr = cb.closest('tr');
        if (tr && tr.style.display !== 'none') {
          cb.checked = selectAll.checked;
          tr.classList.toggle('cd-docs-row-selected', cb.checked);
        }
      });
      applyFilters();
    };
    root.querySelectorAll<HTMLInputElement>('.cd-docs-row-cb').forEach((cb) => {
      cb.onchange = () => {
        cb.closest('tr')?.classList.toggle('cd-docs-row-selected', cb.checked);
        applyFilters();
      };
    });

    deleteBtn.onclick = async () => {
      const selectedIds = Array.from(root.querySelectorAll<HTMLInputElement>('.cd-docs-row-cb:checked'))
        .map((cb) => cb.closest('tr')?.getAttribute('data-doc-id') || '')
        .filter(Boolean);
      if (!selectedIds.length) {
        openInfoModal('No documents selected', 'Select at least one document to delete.');
        return;
      }
      openConfirmDeleteModal(selectedIds.length, async () => {
        deleteBtn.disabled = true;
        try {
          const token = await getTokenRef.current();
          if (!token) return;
          await Promise.all(selectedIds.map((id) => documentsApi.delete(token, id)));
          const fresh = await documentsApi.list(token, { caseId, page: 1, perPage: 100 });
          renderDocsTable(idoc, fresh.data, caseId);
        } catch (err) {
          openInfoModal('Delete failed', formatApiError(err, { fallback: 'Could not delete selected documents. Please try again.' }));
        } finally {
          deleteBtn.disabled = false;
        }
      });
    };

    filterBtn.onclick = () => {
      const types = ['ALL', ...Array.from(new Set(docs.map((d) => d.documentType.toUpperCase())))];
      const opened = Boolean(idoc.getElementById('ko-doc-filter-panel'));
      if (opened) {
        closeDocsFilterPanel();
        return;
      }
      openDocsFilterPanel(types);
    };

    exportBtn.onclick = () => {
      const visibleRows = Array.from(root.querySelectorAll<HTMLTableRowElement>('[data-cd-doc-row]'))
        .filter((tr) => tr.style.display !== 'none');
      if (!visibleRows.length) {
        window.alert('No documents to export for current filter.');
        return;
      }
      const csvRows = [
        ['Document', 'Type', 'File Type', 'Uploaded By', 'Date', 'Status'],
        ...visibleRows.map((tr) => [
          tr.getAttribute('data-doc-name') || '',
          tr.getAttribute('data-doc-type') || '',
          tr.getAttribute('data-doc-ext') || '',
          tr.getAttribute('data-doc-uploaded-by') || '',
          tr.getAttribute('data-doc-date') || '',
          'Active',
        ]),
      ];
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const csv = csvRows.map((row) => row.map((v) => esc(String(v))).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = idoc.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `documents-${caseId}-${stamp}.csv`;
      idoc.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    applyFilters();
  }

  // ── Render real audit-log entries into the Overview timeline track ───────────
  // Mirrors the prototype's exact DOM structure and visual style:
  //   "down" (even i) → meta ABOVE axis, label BELOW  (like "3 weeks ago" / "Remortgage enquiry")
  //   "up"   (odd i)  → label ABOVE axis, meta BELOW  (like "Fact-find completed" / "2 weeks ago")
  const TL_COLORS: Record<string, { color: string; dot: 'solid' | 'hollow' }> = {
    CASE_CREATED:          { color: 'var(--c-enquiry-dot, #3B82F6)', dot: 'solid'  },
    CASE_UPDATED:          { color: 'var(--teal-500, #14B8A6)',       dot: 'hollow' },
    CASE_STAGE_CHANGED:    { color: 'var(--teal-500, #1D9E75)',       dot: 'solid'  },
    DOCUMENT_UPLOADED:     { color: 'var(--teal-500, #1D9E75)',       dot: 'hollow' },
    FACT_FIND_SUBMITTED:   { color: 'var(--c-factfind-dot,#CE652D)', dot: 'solid'  },
    FACT_FIND_COMPLETED:   { color: 'var(--c-factfind-dot,#CE652D)', dot: 'solid'  },
    COMPLIANCE_ADVANCE:    { color: 'var(--c-dip-dot, #A552E4)',      dot: 'solid'  },
    AI_REPORT_GENERATED:   { color: '#EF9F27',                         dot: 'solid'  },
    AI_REPORT_APPROVED:    { color: 'var(--teal-500, #1D9E75)',       dot: 'solid'  },
    MESSAGE_SENT:          { color: 'var(--red, #EF4444)',            dot: 'hollow' },
    NOTE_ADDED:            { color: 'var(--amber, #F59E0B)',           dot: 'hollow' },
  };

  // Human-readable label from an audit log entry — matches mock label style.
  function tlLabel(e: TimelineEntry): string {
    if (e.action === 'CASE_CREATED')       return 'Case created';
    if (e.action === 'DOCUMENT_UPLOADED')  return 'Document uploaded';
    if (e.action === 'AI_REPORT_GENERATED') return 'AI suitability report generated';
    if (e.action === 'AI_REPORT_APPROVED') return 'Suitability report approved';
    if (e.action === 'MESSAGE_SENT')       return 'Client message sent';
    if (e.action === 'FACT_FIND_SUBMITTED') return 'Fact-find submitted';
    if (e.action === 'FACT_FIND_COMPLETED') return 'Fact-find completed';
    if (e.action === 'COMPLIANCE_ADVANCE') return 'Stage advanced';
    if (e.action === 'CASE_STAGE_CHANGED') {
      const d = e.diff as { stage?: { before?: string; after?: string } } | undefined;
      if (d?.stage?.after) {
        const label: Record<string, string> = {
          FACT_FIND: 'Fact-find & research started', RESEARCH: 'Research completed',
          DIP: 'Application submitted', OFFER: 'Offer received', COMPLETION: 'Completion',
        };
        return label[d.stage.after] ?? `Stage → ${d.stage.after.replace(/_/g, ' ')}`;
      }
    }
    // Fallback: SNAKE_CASE → Title Case
    return e.action.split('_').map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  // Relative-time label matching the mock's "3 weeks ago" / "Today 09:41" style.
  function tlTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins  = Math.round(diff / 60000);
    const hours = Math.round(diff / 3600000);
    const days  = Math.round(diff / 86400000);
    const weeks = Math.round(diff / 604800000);
    if (mins  < 2)    return 'Just now';
    if (mins  < 60)   return `${mins} mins ago`;
    if (hours < 24)   return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    if (days  === 1)  return 'Yesterday';
    if (days  < 7)    return `${days} days ago`;
    if (weeks === 1)  return '1 week ago';
    if (weeks < 5)    return `${weeks} weeks ago`;
    // Fall back to absolute for older entries
    return new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function renderTimelineTrack(idoc: Document, entries: TimelineEntry[]) {
    const track = idoc.querySelector<HTMLElement>('.cd-timeline-events');
    if (!track || !entries.length) return;

    // Show the most recent 6 entries — matches the fixed-height (200px) track.
    const visible = entries.slice(-6);

    track.innerHTML = visible.map((entry, i) => {
      const { color, dot: dotStyle } = TL_COLORS[entry.action] ?? { color: '#a1a1aa', dot: 'solid' };
      const dotCls  = dotStyle === 'hollow' ? 'cd-tl-dot--hollow' : 'cd-tl-dot--solid';
      const title   = tlLabel(entry);
      const timeStr = tlTime(entry.createdAt);
      const notify  = entry.notificationSent
        ? ` · <span class="cd-tl-notify">notification sent</span>` : '';
      // metaAbove is used for "down" events; metaBelow for "up" events.
      // Exactly mirrors the prototype: time (+ notification badge if sent).
      const meta = timeStr + notify;
      const layout = i % 2 === 1 ? 'up' : 'down';

      if (layout === 'up') {
        // title ABOVE axis (label-anchor), meta BELOW (prototype uses empty/small text here).
        return `<div class="cd-tl-event cd-tl-event--up">
  <div class="cd-tl-dot ${dotCls}" style="--tl-dot-color:${color}"></div>
  <div class="cd-tl-stem" aria-hidden="true"></div>
  <div class="cd-tl-label-anchor"><p class="cd-tl-label">${title}</p></div>
  <div class="cd-tl-meta">${meta || '&nbsp;'}</div>
</div>`;
      }
      // title BELOW axis (label-anchor), meta ABOVE (same slot as the prototype's metaAbove).
      return `<div class="cd-tl-event cd-tl-event--down">
  <div class="cd-tl-dot ${dotCls}" style="--tl-dot-color:${color}"></div>
  <div class="cd-tl-meta">${meta || '&nbsp;'}</div>
  <div class="cd-tl-stem" aria-hidden="true"></div>
  <div class="cd-tl-label-anchor"><p class="cd-tl-label">${title}</p></div>
</div>`;
    }).join('');
  }

  // ── Message helpers (group multi-channel deliveries into one bubble) ─────────
  function groupMessagesForDisplay(messages: MessageRecord[]) {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    type Group = {
      id: string;
      body: string;
      createdAt: string;
      direction: MessageRecord['direction'];
      isRead: boolean;
      channels: MessageChannel[];
      subject?: string;
    };
    const groups: Group[] = [];
    const indexByKey = new Map<string, number>();
    for (const message of sorted) {
      const key = message.threadId ?? message.id;
      const existing = indexByKey.get(key);
      if (existing === undefined) {
        indexByKey.set(key, groups.length);
        groups.push({
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          direction: message.direction,
          isRead: message.isRead,
          channels: [message.channel],
          subject: message.subject,
        });
      } else {
        const group = groups[existing];
        if (!group.channels.includes(message.channel)) group.channels.push(message.channel);
        group.isRead = group.isRead && message.isRead;
        group.createdAt = message.createdAt;
        // Prefer confirmed (non-optimistic) id when merging.
        if (isOptimisticMessageId(group.id) && !isOptimisticMessageId(message.id)) {
          group.id = message.id;
        }
      }
    }
    return groups;
  }

  function isOptimisticMessageId(id: string) {
    return id.startsWith('optimistic-');
  }

  function threadKeyForCase(caseId: string) {
    return `case-${caseId}`;
  }

  /** Merge server/live rows with in-flight optimistic sends (never drop pending). */
  function mergeThreadMessages(threadKey: string, base: MessageRecord[]): MessageRecord[] {
    const pending = pendingMessagesRef.current[threadKey] ?? [];
    const byId = new Map<string, MessageRecord>();
    for (const m of base) {
      if (!isOptimisticMessageId(m.id)) byId.set(m.id, m);
    }
    for (const p of pending) {
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  function addOptimisticMessage(threadKey: string, msg: MessageRecord) {
    pendingMessagesRef.current[threadKey] = [
      ...(pendingMessagesRef.current[threadKey] ?? []),
      msg,
    ];
    const existing = hubMessagesRef.current[threadKey] ?? [];
    hubMessagesRef.current[threadKey] = mergeThreadMessages(threadKey, [...existing, msg]);
  }

  function confirmOptimisticMessage(threadKey: string, pendingId: string, confirmed: MessageRecord) {
    pendingMessagesRef.current[threadKey] = (pendingMessagesRef.current[threadKey] ?? []).filter(
      (m) => m.id !== pendingId,
    );
    const live = hubMessagesRef.current[threadKey] ?? [];
    hubMessagesRef.current[threadKey] = mergeThreadMessages(threadKey, [
      ...live.filter((m) => m.id !== pendingId && m.id !== confirmed.id),
      confirmed,
    ]);
  }

  function dropOptimisticMessage(threadKey: string, pendingId: string) {
    pendingMessagesRef.current[threadKey] = (pendingMessagesRef.current[threadKey] ?? []).filter(
      (m) => m.id !== pendingId,
    );
    const live = hubMessagesRef.current[threadKey] ?? [];
    hubMessagesRef.current[threadKey] = mergeThreadMessages(
      threadKey,
      live.filter((m) => m.id !== pendingId),
    );
  }

  function notifyDeliveryIssues(meta: unknown) {
    if (!meta || typeof meta !== 'object') return;
    const delivery = (meta as { delivery?: MessageDeliveryMeta }).delivery;
    if (!delivery?.errors?.length) return;
    window.alert(`Message saved, but some deliveries failed:\n\n${delivery.errors.join('\n')}`);
  }

  function hubComposerHtml(threadKey: string, name: string): string {
    return `<div class="msg-hub-composer">
      <input type="text" class="msg-hub-composer-input" data-thread-key="${threadKey}" placeholder="Reply to ${name}...">
      <button type="button" class="msg-hub-composer-send" data-thread-key="${threadKey}">Send reply</button>
    </div>`;
  }

  // ── Render real messages into the Messages tab ───────────────────────────────
  // Mirrors the prototype's .cd-msg-feed bubble structure exactly.
  function renderMessagesThread(idoc: Document, caseId: string, messages?: MessageRecord[]) {
    const feed = idoc.querySelector<HTMLElement>(`#caseview-msgs-${caseId} .cd-msg-feed`);
    if (!feed) return;

    if (!hasMessagesRef.current) {
      renderMessagesPlanLocked(idoc, caseId);
      return;
    }

    const panel = idoc.querySelector(`#caseview-msgs-${caseId}`);
    const composer = panel?.querySelector<HTMLElement>('.cd-msg-composer');
    if (composer) composer.style.display = '';

    const threadKey = threadKeyForCase(caseId);
    const merged = mergeThreadMessages(
      threadKey,
      messages ?? hubMessagesRef.current[threadKey] ?? [],
    );
    hubMessagesRef.current[threadKey] = merged;

    if (!merged.length) {
      feed.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#a1a1aa;font-size:13px;font-family:'DM Sans',sans-serif">No messages yet. Start the conversation below.</div>`;
    } else {
      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let lastDate = '';
      feed.innerHTML = groupMessagesForDisplay(merged).map((group) => {
        const d = new Date(group.createdAt);
        const dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeLabel = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const dateSep = dateLabel !== lastDate ? `<div class="cd-msg-date">${dateLabel}</div>` : '';
        lastDate = dateLabel;
        const tickSvg =
          group.isRead && !isOptimisticMessageId(group.id)
            ? `<span class="cd-msg-ticks cd-msg-ticks--blue">✓✓</span>`
            : `<span class="cd-msg-ticks cd-msg-ticks--gray">✓</span>`;
        if (group.direction === 'OUTBOUND') {
          return `${dateSep}<div class="cd-msg-row cd-msg-row--out">
  <div class="cd-msg-bubble cd-msg-bubble--out">
    <p class="cd-msg-bubble-text">${escHtml(group.body)}</p>
    <div class="cd-msg-bubble-meta"><span>${timeLabel}</span>${tickSvg}</div>
  </div>
  ${group.isRead && !isOptimisticMessageId(group.id) ? '<span class="cd-msg-sent">✓✓ Sent</span>' : ''}
</div>`;
        }
        return `${dateSep}<div class="cd-msg-row cd-msg-row--in">
  <div class="cd-msg-bubble cd-msg-bubble--in">
    <p class="cd-msg-bubble-text">${escHtml(group.body)}</p>
    <div class="cd-msg-bubble-meta"><span>${timeLabel}</span></div>
  </div>
</div>`;
      }).join('');
    }
    feed.scrollTop = feed.scrollHeight;
    wireMessageComposer(idoc, caseId);
  }

  // Attach send handlers to the composer inside a specific case's Messages tab.
  // Clones the send button to strip old listeners before adding the API call.
  function wireMessageComposer(idoc: Document, caseId: string) {
    const panel = idoc.querySelector(`#caseview-msgs-${caseId}`);
    if (!panel) return;
    if (!hasMessagesRef.current) {
      renderMessagesPlanLocked(idoc, caseId);
      return;
    }
    const input = panel.querySelector<HTMLInputElement>('.cd-msg-composer-input');
    const sendBtn = panel.querySelector<HTMLButtonElement>('.cd-msg-composer-btn--send');
    if (!input || !sendBtn) return;

    // Clone send button to remove any pre-existing listeners.
    const freshBtn = sendBtn.cloneNode(true) as HTMLButtonElement;
    sendBtn.parentNode?.replaceChild(freshBtn, sendBtn);
    // Mark wired so the document click handler does not double-send.
    freshBtn.setAttribute('data-ko-wired', '1');

    const doSend = async () => {
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      const threadKey = threadKeyForCase(caseId);
      const pendingId = `optimistic-${crypto.randomUUID()}`;
      const optimistic = {
        id: pendingId,
        orgId: '',
        body,
        channel: 'IN_APP' as const,
        direction: 'OUTBOUND' as const,
        sourceType: 'CASE_UPDATE' as const,
        isRead: false,
        createdAt: new Date().toISOString(),
        caseId,
      } satisfies MessageRecord;
      addOptimisticMessage(threadKey, optimistic);
      renderMessagesThread(idoc, caseId);
      try {
        const token = await getTokenRef.current();
        if (!token) {
          dropOptimisticMessage(threadKey, pendingId);
          renderMessagesThread(idoc, caseId);
          return;
        }
        const result = await messagesApi.send(token, { body, caseId, sourceType: 'CASE_UPDATE' });
        notifyDeliveryIssues(result.meta);
        if (result.data) {
          confirmOptimisticMessage(threadKey, pendingId, result.data);
        } else {
          dropOptimisticMessage(threadKey, pendingId);
        }
        renderMessagesThread(idoc, caseId);
        void refreshMessagesHubFromApi(idoc);
      } catch {
        dropOptimisticMessage(threadKey, pendingId);
        renderMessagesThread(idoc, caseId);
      } finally {
        input.focus();
      }
    };

    freshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void doSend();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void doSend();
      }
    });
  }

  function renderHubThreadPanel(idoc: Document, threadKey: string) {
    const panel = idoc.getElementById('msg-hub-thread');
    if (!panel) return;
    const msgs = mergeThreadMessages(threadKey, hubMessagesRef.current[threadKey] ?? []);
    hubMessagesRef.current[threadKey] = msgs;
    const meta = hubMetaRef.current[threadKey];
    if (!meta) return;
    const bubbles = groupMessagesForDisplay(msgs).map((group) => {
      const tm = new Date(group.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      if (group.direction === 'OUTBOUND') {
        return `<div class="msg-hub-bbl-row msg-hub-bbl-row--out"><div class="msg-hub-bbl-col"><div class="msg-hub-bbl msg-hub-bbl--out">${group.body}</div><div class="msg-hub-bbl-time msg-hub-bbl-time--out">${tm}</div></div><div class="msg-hub-bbl-av" style="background:#0F6E56">AD</div></div>`;
      }
      return `<div class="msg-hub-bbl-row msg-hub-bbl-row--in"><div class="msg-hub-bbl-av" style="background:#1D9E75">CL</div><div class="msg-hub-bbl-col"><div class="msg-hub-bbl msg-hub-bbl--in">${group.body}</div><div class="msg-hub-bbl-time msg-hub-bbl-time--in">${tm}</div></div></div>`;
    }).join('');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.height = '100%';
    panel.style.minHeight = '0';
    panel.style.overflow = 'hidden';
    panel.innerHTML = `<div class="msg-hub-thread-hd">
      <button type="button" class="msg-hub-thread-back" aria-label="Back to messages"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <div class="msg-hub-thread-hd-av" style="background:#0F6E56">${meta.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div class="msg-hub-thread-name">${meta.name}</div>
        <div class="msg-hub-thread-tags">
          <span class="msg-hub-thread-tag msg-hub-thread-tag--client">${meta.type}</span>
          <span class="msg-hub-thread-tag msg-hub-thread-tag--ref">· ${meta.caseRef}</span>
          <span class="msg-hub-thread-tag msg-hub-thread-tag--ref">· ${meta.caseSub}</span>
        </div>
      </div>
      <button type="button" class="msg-hub-thread-close" title="Close">✕</button>
    </div>
    <div class="msg-hub-thread-feed" id="msg-hub-feed">${bubbles}</div>
    ${hubComposerHtml(threadKey, meta.name)}`;
    const feed = panel.querySelector<HTMLElement>('#msg-hub-feed');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }

  function messagesPlanLockedHtml(): string {
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px 20px;text-align:center;color:#71717a;font-size:13px;font-family:'DM Sans',sans-serif;min-height:180px">
      <div style="font-size:28px;line-height:1">🔒</div>
      <p style="margin:0;font-weight:600;color:#18181b">Messages require Professional</p>
      <p style="margin:0;max-width:280px">Upgrade to Professional to send in-app, email, and SMS messages from case threads.</p>
    </div>`;
  }

  function renderMessagesPlanLocked(idoc: Document, caseId: string) {
    const panel = idoc.querySelector(`#caseview-msgs-${caseId}`);
    const feed = panel?.querySelector<HTMLElement>('.cd-msg-feed');
    if (feed) feed.innerHTML = messagesPlanLockedHtml();
    const composer = panel?.querySelector<HTMLElement>('.cd-msg-composer');
    if (composer) composer.style.display = 'none';
  }

  function clearMessagesHubDemo(idoc: Document, message?: string) {
    if (!hasMessagesRef.current) {
      renderMessagesHubPlanLocked(idoc);
      return;
    }
    const tbody = idoc.querySelector<HTMLTableSectionElement>('#tab-messages .msg-hub-tbl tbody');
    if (tbody && !tbody.querySelector('.ko-msg-hub-row')) {
      tbody.innerHTML = `<tr class="msg-hub-loading-row"><td colspan="6" style="padding:48px 24px;text-align:center;color:#71717a;font-size:13px;font-family:'DM Sans',sans-serif">${
        message ?? 'Loading messages…'
      }</td></tr>`;
    }
    const statVals = idoc.querySelectorAll<HTMLElement>('#tab-messages .msg-hub-stats .msg-stat-card .msg-stat-val');
    statVals.forEach((el, index) => {
      el.textContent = index === 3 ? '—' : '0';
    });
    const footer = idoc.querySelector('#tab-messages .msg-hub-footer');
    if (footer) footer.innerHTML = '<span>Loading messages…</span>';
    const thread = idoc.getElementById('msg-hub-thread');
    if (thread) {
      thread.style.display = 'none';
      thread.innerHTML = '';
    }
    hubMessagesRef.current = {};
    hubMetaRef.current = {};
  }

  function renderMessagesHubPlanLocked(idoc: Document) {
    const tbody = idoc.querySelector<HTMLTableSectionElement>('#tab-messages .msg-hub-tbl tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:48px 24px;text-align:center;color:#71717a;font-size:13px;font-family:'DM Sans',sans-serif">${messagesPlanLockedHtml()}</td></tr>`;
    }
    const footer = idoc.querySelector('#tab-messages .msg-hub-footer');
    if (footer) footer.innerHTML = '<span>Messages unavailable on Starter plan</span>';
  }

  function formatMessageSendError(err: unknown): string {
    if (isApiErrorCode(err, API_ERROR_CODES.PLAN_LIMIT_EXCEEDED)) {
      return 'Messages require a Professional or Enterprise plan. Upgrade in Settings or contact your admin.';
    }
    return formatApiError(err, { fallback: 'Could not send message. Please try again.' });
  }

  async function refreshMessagesHubFromApi(idoc: Document) {
    if (!isPersonalDashboard) return;
    if (!hasMessagesRef.current) {
      renderMessagesHubPlanLocked(idoc);
      return;
    }
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const all = await messagesApi.list(token, { page: 1, perPage: 100 });
      const gen = ++messagesListGenRef.current;
      const rowsByThread: Record<string, MessageRecord[]> = {};
      const metaByThread: Record<string, { name: string; caseRef: string; caseSub: string; stage: string; type: 'client' | 'system' }> = {};
      for (const m of all.data) {
        const key = m.caseId ? `case-${m.caseId}` : `client-${m.clientId ?? 'general'}`;
        if (!rowsByThread[key]) rowsByThread[key] = [];
        rowsByThread[key].push(m);
        if (!metaByThread[key]) {
          const c = m.caseId ? casesDataRef.current.find((k) => k.id === m.caseId) : undefined;
          const name = c?.client ? `${c.client.firstName} ${c.client.lastName}` : 'Client conversation';
          metaByThread[key] = {
            name,
            caseRef: c?.referenceNumber ?? '—',
            caseSub: c?.type?.replace(/_/g, ' ') ?? 'General',
            stage: c?.stage?.replace(/_/g, ' ') ?? 'Enquiry',
            type: 'client',
          };
        }
      }
      Object.values(rowsByThread).forEach((arr) =>
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      );
      if (gen !== messagesListGenRef.current) return;

      // Merge — never wipe in-flight optimistic sends.
      const next: Record<string, MessageRecord[]> = {};
      const keys = new Set([
        ...Object.keys(rowsByThread),
        ...Object.keys(pendingMessagesRef.current),
        ...Object.keys(hubMessagesRef.current),
      ]);
      for (const key of keys) {
        next[key] = mergeThreadMessages(key, rowsByThread[key] ?? []);
      }
      hubMessagesRef.current = next;
      hubMetaRef.current = { ...hubMetaRef.current, ...metaByThread };
      const tbody = idoc.querySelector<HTMLTableSectionElement>('#tab-messages .msg-hub-tbl tbody');
      if (!tbody) return;
      const tableKeys = Object.keys(next)
        .filter((k) => (next[k]?.length ?? 0) > 0)
        .sort((a, b) => {
          const am = next[a][next[a].length - 1];
          const bm = next[b][next[b].length - 1];
          return new Date(bm.createdAt).getTime() - new Date(am.createdAt).getTime();
        });
      if (!tableKeys.length) {
        tbody.innerHTML =
          '<tr class="msg-hub-empty-row"><td colspan="6" style="padding:48px 24px;text-align:center;color:#71717a;font-size:13px;font-family:\'DM Sans\',sans-serif">No messages yet.</td></tr>';
        const footer = idoc.querySelector('#tab-messages .msg-hub-footer');
        if (footer) footer.innerHTML = '<span>0 messages</span>';
        const statVals = idoc.querySelectorAll<HTMLElement>('#tab-messages .msg-hub-stats .msg-stat-card .msg-stat-val');
        const statSubs = idoc.querySelectorAll<HTMLElement>('#tab-messages .msg-hub-stats .msg-stat-card .msg-stat-sub');
        if (statVals[0]) statVals[0].textContent = '0';
        if (statVals[1]) statVals[1].textContent = '0';
        if (statVals[2]) statVals[2].textContent = '0';
        if (statVals[3]) statVals[3].textContent = '—';
        if (statSubs[3]) statSubs[3].textContent = 'No reply pairs yet';
        return;
      }
      tbody.innerHTML = tableKeys.map((k) => {
        const msgs = next[k];
        const grouped = groupMessagesForDisplay(msgs);
        const last = grouped[grouped.length - 1];
        const meta = hubMetaRef.current[k] ?? metaByThread[k];
        if (!meta || !last) return '';
        const initials = meta.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'CL';
        const t = tlTime(last.createdAt);
        const typeLabel = meta.type === 'system' ? 'System' : 'Client';
        return `<tr class="msg-hub-row ko-msg-hub-row" data-thread-key="${k}">
        <td><div class="msg-contact"><div class="msg-contact-av" style="background:#0F6E56">${initials}</div><div><div class="msg-contact-name">${meta.name}</div><div class="msg-contact-adviser">Live API</div></div></div></td>
        <td><div class="msg-subject-line"><span class="msg-subject-dot ${last.isRead ? 'msg-subject-dot--read' : 'msg-subject-dot--unread'}"></span>${last.subject ?? 'Message update'}</div><div class="msg-subject-preview">${last.body}</div></td>
        <td><div class="msg-case-ref">${meta.caseRef}</div><div class="msg-case-type">${meta.caseSub}</div></td>
        <td><span class="msg-stage msg-stage--factfind">${meta.stage}</span></td>
        <td><div class="msg-type-cell">${typeLabel}</div></td>
        <td><div class="msg-time-val">${t}</div></td>
      </tr>`;
      }).join('');
      const footer = idoc.querySelector('#tab-messages .msg-hub-footer');
      if (footer) footer.innerHTML = `<span>${tableKeys.length} of ${tableKeys.length} messages</span><span class="msg-hub-footer-unread">${all.data.filter((m) => !m.isRead).length} unread</span>`;

      // Update the four Messages Hub KPI cards with live aggregates.
      const totalMessages = all.data.length;
      const unreadMessages = all.data.filter((m) => !m.isRead).length;
      const actionRequired = all.data.filter(
        (m) => !m.isRead && (m.direction === 'INBOUND' || m.direction === 'SYSTEM'),
      ).length;
      // Average response time: inbound -> next outbound in same thread.
      const responseMinutes: number[] = [];
      Object.values(next).forEach((thread) => {
        for (let i = 0; i < thread.length; i += 1) {
          const current = thread[i];
          if (current.direction !== 'INBOUND') continue;
          const inboundAt = new Date(current.createdAt).getTime();
          const nextOutbound = thread.slice(i + 1).find((m) => m.direction === 'OUTBOUND');
          if (!nextOutbound) continue;
          const outboundAt = new Date(nextOutbound.createdAt).getTime();
          if (outboundAt <= inboundAt) continue;
          responseMinutes.push(Math.round((outboundAt - inboundAt) / 60000));
        }
      });
    const avgMins = responseMinutes.length
      ? Math.round(responseMinutes.reduce((sum, n) => sum + n, 0) / responseMinutes.length)
      : 0;
    const avgResponseLabel = avgMins >= 60
      ? `${Math.round(avgMins / 60)}h`
      : `${avgMins}m`;

    const statVals = idoc.querySelectorAll<HTMLElement>('#tab-messages .msg-hub-stats .msg-stat-card .msg-stat-val');
    const statSubs = idoc.querySelectorAll<HTMLElement>('#tab-messages .msg-hub-stats .msg-stat-card .msg-stat-sub');
    if (statVals[0]) statVals[0].textContent = String(totalMessages);
    if (statVals[1]) statVals[1].textContent = String(unreadMessages);
    if (statVals[2]) statVals[2].textContent = String(actionRequired);
    if (statVals[3]) statVals[3].textContent = avgResponseLabel;
    if (statSubs[0]) statSubs[0].textContent = 'All time';
    if (statSubs[1]) statSubs[1].textContent = 'Requires attention';
    if (statSubs[2]) statSubs[2].textContent = 'Unread inbound/system';
    if (statSubs[3]) statSubs[3].textContent = responseMinutes.length ? 'Based on replies' : 'No reply pairs yet';
      // Keep open hub thread in sync with merged messages.
      const openInput = idoc.querySelector<HTMLInputElement>('.msg-hub-composer-input[data-thread-key]');
      const openKey = openInput?.getAttribute('data-thread-key');
      if (openKey) renderHubThreadPanel(idoc, openKey);
    } catch (err) {
      if (isApiErrorCode(err, API_ERROR_CODES.PLAN_LIMIT_EXCEEDED)) {
        renderMessagesHubPlanLocked(idoc);
      }
    }
  }

  function clearAiHubDemo(idoc: Document, message?: string) {
    const tbody = idoc.getElementById('ai-rpt-table-body');
    const subtitle = idoc.getElementById('ai-rpt-subtitle');
    const statTotal = idoc.getElementById('ai-rpt-stat-total');
    const statFlags = idoc.getElementById('ai-rpt-stat-flags');
    const clientTotal = clientsDataRef.current.length;
    if (tbody) {
      tbody.innerHTML = `<tr class="ai-rpt-empty-row"><td colspan="6">${
        message ??
        (hasAiReportsRef.current
          ? 'No AI reports yet — generate a report from a case to see it here.'
          : 'AI reports are not available on your plan or visibility settings.')
      }</td></tr>`;
    }
    if (subtitle) subtitle.textContent = `${clientTotal} of ${clientTotal} clients`;
    if (statTotal) statTotal.textContent = '0';
    if (statFlags) statFlags.textContent = '0';
  }

  async function refreshAiHubFromApi(idoc: Document) {
    if (!isPersonalDashboard) return;
    if (!hasAiReportsRef.current) {
      clearAiHubDemo(idoc);
      return;
    }
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      const res = await aiApi.listReports(token, { page: 1, perPage: 100 });
      const tbody = idoc.getElementById('ai-rpt-table-body');
      const subtitle = idoc.getElementById('ai-rpt-subtitle');
      const statTotal = idoc.getElementById('ai-rpt-stat-total');
      const statFlags = idoc.getElementById('ai-rpt-stat-flags');
      if (!tbody) return;

      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const templateLabels: Record<string, string> = {
        BTL: 'Buy-to-let',
        FTB: 'First-time buyer',
        REMORTGAGE: 'Remortgage',
        HOME_MOVER: 'Home mover',
        PRODUCT_TRANSFER: 'Product transfer',
        DIVORCE: 'Divorce/separation',
        SELF_EMPLOYED: 'Self-employed',
        VULNERABLE_OVERLAY: 'Vulnerable overlay',
      };

    const clientTotal = clientsDataRef.current.length;

    if (!res.data.length) {
      clearAiHubDemo(idoc);
      return;
    }

    let redFlagCount = 0;
    const rows = res.data.map((r) => {
      const caseItem = casesDataRef.current.find((k) => k.id === r.caseId);
      const clientName = caseItem?.client
        ? `${caseItem.client.firstName} ${caseItem.client.lastName}`
        : 'Client';
      const clientEmail = caseItem?.client?.email ?? '—';
      const caseRef = caseItem?.referenceNumber ?? r.caseId;
      const templateLabel = templateLabels[r.templateType] ?? r.templateType.replace(/_/g, ' ');
      const searchKey = `${clientName} ${clientEmail} ${caseRef} ${templateLabel}`.toLowerCase();

      const isFinished = r.status === 'APPROVED' || r.status === 'FINALISED';
      const isInactive = r.status === 'DRAFT' && !caseItem;
      const statusClass = isFinished ? 'finished' : isInactive ? 'inactive' : 'active';
      const statusLabel = isFinished ? 'Finished' : isInactive ? 'Inactive' : 'Active';

      let auditHtml: string;
      if (isFinished) {
        auditHtml = '<span class="ai-rpt-audit ai-rpt-audit--pass">✓ Pass</span>';
      } else if (r.status === 'DRAFT') {
        auditHtml = '<span class="ai-rpt-audit ai-rpt-audit--fail">× Fail</span>';
        redFlagCount += 1;
      } else if (r.status === 'ADVISER_REVIEW') {
        auditHtml =
          '<span class="ai-rpt-status ai-rpt-status--active"><span class="ai-rpt-status-dot"></span>Active</span>';
        redFlagCount += 1;
      } else {
        auditHtml =
          '<span class="ai-rpt-status ai-rpt-status--inactive"><span class="ai-rpt-status-dot"></span>Inactive</span>';
      }

      return `<tr data-ai-rpt-row data-template="${esc(r.templateType)}" data-search="${esc(searchKey)}">
        <td class="ai-rpt-col-check"><input type="checkbox" class="ai-rpt-checkbox ai-rpt-row-cb" aria-label="Select ${esc(clientName)}"></td>
        <td><div class="ai-rpt-client-name">${esc(clientName)}</div><div class="ai-rpt-client-email">${esc(clientEmail)}</div></td>
        <td class="ai-rpt-cell-muted">${esc(caseRef)}</td>
        <td class="ai-rpt-cell-muted">${esc(templateLabel)}</td>
        <td><span class="ai-rpt-status ai-rpt-status--${statusClass}"><span class="ai-rpt-status-dot"></span>${statusLabel}</span></td>
        <td>${auditHtml}</td>
      </tr>`;
    });

    tbody.innerHTML = rows.join('');
    if (subtitle) {
      const reportClients = new Set(
        res.data
          .map((r) => casesDataRef.current.find((c) => c.id === r.caseId)?.client?.email)
          .filter(Boolean),
      );
      const shown = reportClients.size || res.data.length;
      subtitle.textContent = `${shown} of ${clientTotal || shown} clients`;
    }
    if (statTotal) statTotal.textContent = String(res.data.length);
    if (statFlags) statFlags.textContent = String(redFlagCount);

    const iwin = idoc.defaultView as Window & { applyAiReportsFilters?: () => void };
    iwin?.applyAiReportsFilters?.();
    } catch (err) {
      // Adviser without canViewAiSummaries (or other access errors) — clear prototype demo rows.
      if (isApiErrorCode(err, API_ERROR_CODES.FORBIDDEN) || isApiErrorCode(err, API_ERROR_CODES.PLAN_LIMIT_EXCEEDED)) {
        clearAiHubDemo(idoc);
        return;
      }
      console.warn('[refreshAiHubFromApi]', err);
    }
  }

  // ── Inject "Advance Stage" button into the compliance tab ────────────────────
  // Direct listener on the button (not delegated) avoids any iframe click-handler
  // interference and is simpler to reason about for async flows.
  const NEXT_STAGE: Partial<Record<CaseStage, { toStage: CaseStage; label: string }>> = {
    ENQUIRY:   { toStage: 'FACT_FIND',  label: 'Fact-Find' },
    FACT_FIND: { toStage: 'RESEARCH',   label: 'Research' },
    RESEARCH:  { toStage: 'DIP',        label: 'Application' },
    DIP:       { toStage: 'OFFER',      label: 'Offer' },
    OFFER:     { toStage: 'COMPLETION', label: 'Completion' },
  };

  function updateCompliancePanel(idoc: Document, caseId: string, apiStage: string) {
    const compCard = idoc.querySelector<HTMLElement>('.cd-comp-card');
    if (!compCard) return;
    compCard
      .querySelectorAll('.ko-comp-advance-btn, .ko-comp-stage-info, .ko-products-panel')
      .forEach((el) => el.remove());

    // Force the compliance progress rail to reflect the real API stage.
    // The prototype defaults some API-loaded cases to enquiry; we correct the
    // dots/pills/connectors here after case HTML is rendered.
    const stageToIdx: Record<string, number> = {
      ENQUIRY: 0,
      FACT_FIND: 1,
      RESEARCH: 2,
      DIP: 3,
      OFFER: 4,
      COMPLETION: 4,
    };
    const idx = stageToIdx[apiStage] ?? 0;
    const themes = [
      { line: '#9ddbea', dot: '#066D80', bg: '#EAFCFF', border: '#7fc8dc', text: '#066D80', label: 'Enquiry' },
      { line: '#f3c8b4', dot: '#CE652D', bg: '#FFF9F5', border: '#efb89c', text: '#CE652D', label: 'Fact-Find' },
      { line: '#d9b8f2', dot: '#A552E4', bg: '#F5EEFA', border: '#cba6ea', text: '#A552E4', label: 'Research' },
      { line: '#efb3e8', dot: '#CE2DB0', bg: '#FFF1FD', border: '#e596d9', text: '#CE2DB0', label: 'Application' },
      { line: '#9fe2cf', dot: '#0F6E56', bg: '#EDFFFA', border: '#8fd7c2', text: '#0F6E56', label: 'Offer' },
    ];
    const gray = { line: '#e4e4e7', dot: '#d4d4d8', bg: '#f4f4f5', border: '#e4e4e7', text: '#a1a1aa' };
    const steps = Array.from(compCard.querySelectorAll<HTMLElement>('.cd-comp-step'));
    steps.forEach((stepEl, i) => {
      const isComplete = i < idx;
      const isCurrent = i === idx;
      const isPending = i > idx;
      const theme = isPending ? gray : themes[i] ?? gray;

      const dot = stepEl.querySelector<HTMLElement>('.cd-comp-dot');
      if (dot) {
        dot.classList.toggle('cd-comp-dot--pending', isPending);
        dot.classList.toggle('cd-comp-dot--done', !isPending);
        dot.style.setProperty('--dot-color', theme.dot);
      }

      const pill = stepEl.querySelector<HTMLElement>('.cd-comp-pill');
      if (pill) {
        pill.classList.toggle('cd-comp-pill--current', isCurrent);
        pill.classList.toggle('cd-comp-pill--pending', isPending);
        pill.style.setProperty('--pill-bg', theme.bg);
        pill.style.setProperty('--pill-border', theme.border);
        pill.style.setProperty('--pill-color', theme.text);
      }

      const conns = stepEl.querySelectorAll<HTMLElement>('.cd-comp-connector');
      const left = conns[0];
      const right = conns[1];
      if (left) left.style.background = i === 0 ? 'transparent' : (i <= idx ? themes[i - 1]?.line ?? gray.line : gray.line);
      if (right) right.style.background = i === steps.length - 1 ? 'transparent' : (i < idx ? themes[i]?.line ?? gray.line : gray.line);
    });
    const reqStage = compCard.querySelector<HTMLElement>('.cd-comp-req-stage');
    if (reqStage) {
      const t = themes[idx] ?? themes[0];
      reqStage.textContent = t.label;
      reqStage.style.color = t.text;
    }

    const next = NEXT_STAGE[apiStage as CaseStage];

    // Record products during Fact-Find / Research so RESEARCH → DIP can pass checklist.
    if (apiStage === 'FACT_FIND' || apiStage === 'RESEARCH') {
      void mountResearchProductsPanel(compCard, caseId, apiStage).then(() => {
        appendAdvanceControls(compCard, caseId, apiStage, next);
      });
      return;
    }

    appendAdvanceControls(compCard, caseId, apiStage, next);
  }

  function appendAdvanceControls(
    compCard: HTMLElement,
    caseId: string,
    apiStage: string,
    next: { toStage: CaseStage; label: string } | undefined,
  ) {
    compCard.querySelectorAll('.ko-comp-advance-btn, .ko-comp-stage-info').forEach((el) => el.remove());

    const info = document.createElement('p');
    info.className = 'ko-comp-stage-info';
    info.style.cssText =
      "margin:16px 0 0;font-size:13px;color:#71717a;font-family:'DM Sans',sans-serif";
    info.textContent = next
      ? `Current stage: ${apiStage.replace(/_/g, ' ')}`
      : 'Case is at the final stage (Completion).';
    compCard.appendChild(info);
    if (!next) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ko-comp-advance-btn';
    btn.style.cssText =
      "margin-top:16px;padding:10px 24px;background:#1D9E75;color:#fff;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;width:100%;box-shadow:0 4px 12px rgba(29,158,117,0.2);transition:opacity .15s";
    btn.textContent = `Advance to ${next.label} →`;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ((btn as HTMLButtonElement).disabled) return;
      (btn as HTMLButtonElement).disabled = true;
      btn.style.opacity = '0.6';
      btn.textContent = 'Advancing…';
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');

        const advanced = await complianceApi.advanceStage(token, {
          caseId,
          targetStage: next.toStage,
        });
        applyUpdatedCaseToCache(queryClient, advanced.data);
        softInvalidateDashboardLists(queryClient);

        const bootstrap = queryClient.getQueryData<{
          data: { cases: CaseSummary[] };
        }>(dashboardBootstrapQueryKey);
        if (bootstrap?.data.cases) {
          casesDataRef.current = bootstrap.data.cases;
          syncLiveDataToIframe();
        }

        // Paint the new stage immediately from the advance response.
        updateCompliancePanel(compCard.ownerDocument, caseId, advanced.data.stage);

        const [updated, freshTl] = await Promise.all([
          casesApi.get(token, caseId).catch(() => ({ data: advanced.data })),
          casesApi.timeline(token, caseId).catch(() => null),
        ]);
        if (freshTl) {
          queryClient.setQueryData(['cases', caseId, 'timeline'], freshTl);
        }

        iframeRef.current?.contentWindow?.postMessage(
          { type: 'ko:case-detail', case: updated.data },
          window.location.origin,
        );
        window.setTimeout(() => {
          const freshIdoc = iframeRef.current?.contentDocument;
          if (!freshIdoc) return;
          updateCompliancePanel(freshIdoc, caseId, updated.data.stage);
          if (freshTl) renderTimelineTrack(freshIdoc, freshTl.data);
          const compTab = freshIdoc.querySelector<HTMLElement>(
            `.cd-tab[onclick*="compliance-${caseId}"]`,
          );
          compTab?.click();
        }, 80);
      } catch (err) {
        (btn as HTMLButtonElement).disabled = false;
        btn.style.opacity = '1';
        btn.textContent = `Advance to ${next.label} →`;
        const details = getApiErrorDetails(err)?.filter(Boolean).join('\n') ?? '';
        window.alert(
          [
            formatApiError(err, {
              fallback: 'Could not advance stage. Please check all compliance requirements are met.',
            }),
            details,
          ]
            .filter(Boolean)
            .join('\n\n'),
        );
      }
    });

    compCard.appendChild(btn);
  }

  async function mountResearchProductsPanel(
    compCard: HTMLElement,
    caseId: string,
    apiStage: string,
  ) {
    const panel = document.createElement('div');
    panel.className = 'ko-products-panel';
    panel.style.cssText =
      'margin-top:20px;padding-top:20px;border-top:1px solid #f4f4f5;font-family:\'DM Sans\',sans-serif';
    panel.innerHTML = `<p style="margin:0;font-size:13px;color:#71717a">Loading products…</p>`;
    compCard.appendChild(panel);

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const refresh = async () => {
      try {
        const token = await getTokenRef.current();
        if (!token) throw new Error('Not authenticated');
        const [productsRes, caseRes] = await Promise.all([
          casesApi.listProducts(token, caseId),
          casesApi.get(token, caseId),
        ]);
        const products = productsRes.data ?? [];
        const notes = caseRes.data.adviserNotes ?? '';
        const selectedCount = products.filter((p) => p.isSelected).length;
        const ready = products.length >= 3 && selectedCount >= 1 && notes.trim().length > 0;

        caseDetailRef.current[caseId] = {
          ...caseDetailRef.current[caseId],
          selectedLender: caseRes.data.selectedLender,
          selectedProduct: caseRes.data.selectedProduct,
          selectedRate: caseRes.data.selectedRate,
          selectedFee: caseRes.data.selectedFee,
          adviserNotes: caseRes.data.adviserNotes,
          stage: caseRes.data.stage,
        };

        const checklist = compCard.querySelector('.cd-comp-checklist');
        if (checklist && (apiStage === 'FACT_FIND' || apiStage === 'RESEARCH')) {
          const items = [
            {
              ok: products.length >= 3,
              label: `At least 3 products recorded (${products.length}/3)`,
            },
            {
              ok: selectedCount >= 1,
              label: 'Recommended product selected',
            },
            {
              ok: notes.trim().length > 0,
              label: 'Adviser recommendation notes written',
            },
          ];
          checklist.innerHTML = items
            .map(
              (item) =>
                `<li class="cd-comp-check-item"><input type="checkbox" class="cd-comp-check" ${item.ok ? 'checked' : ''} disabled aria-label="${esc(item.label)}"><span>${esc(item.label)}</span></li>`,
            )
            .join('');
        }

        const rows =
          products.length === 0
            ? `<p style="margin:0 0 12px;font-size:13px;color:#a1a1aa">No products recorded yet. Add at least 3 before advancing past Research.</p>`
            : `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">${products
                .map((p) => renderProductRow(p, esc))
                .join('')}</div>`;

        panel.innerHTML = `
          <h3 style="margin:0 0 6px;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#18181b">Products considered</h3>
          <p style="margin:0 0 14px;font-size:12px;color:#71717a;line-height:1.45">
            Record market research options here${apiStage === 'FACT_FIND' ? ' before advancing to Research' : ''}.
            Compliance needs <strong>3+ products</strong>, one <strong>selected</strong>, and <strong>adviser notes</strong>.
            ${ready ? '<span style="color:#0F6E56;font-weight:600"> Ready to advance.</span>' : ''}
          </p>
          ${rows}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:#71717a">Lender
              <input data-ko-prod="lender" type="text" placeholder="e.g. NatWest" style="padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;color:#18181b" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:#71717a">Product name
              <input data-ko-prod="product" type="text" placeholder="e.g. 5yr Fixed" style="padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;color:#18181b" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:#71717a">Rate (%)
              <input data-ko-prod="rate" type="number" step="0.01" placeholder="4.20" style="padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;color:#18181b" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:#71717a">Fee (£)
              <input data-ko-prod="fee" type="number" step="1" placeholder="999" style="padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;color:#18181b" />
            </label>
          </div>
          <label style="display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:12px;color:#52525b">
            <input data-ko-prod="selected" type="checkbox" /> Mark as recommended product
          </label>
          <button type="button" data-ko-prod-add style="margin-bottom:16px;padding:8px 14px;background:#A552E4;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Add product</button>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;color:#71717a">Adviser recommendation notes
            <textarea data-ko-prod="notes" rows="3" placeholder="Why this product is suitable…" style="padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;color:#18181b;resize:vertical;font-family:inherit">${esc(notes)}</textarea>
          </label>
          <button type="button" data-ko-prod-notes style="margin-top:8px;padding:8px 14px;background:#fff;color:#18181b;border:1px solid #e4e4e7;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Save notes</button>
          <p data-ko-prod-status style="margin:8px 0 0;font-size:12px;color:#71717a;min-height:16px"></p>
        `;

        const statusEl = panel.querySelector<HTMLElement>('[data-ko-prod-status]');
        const setStatus = (text: string, color = '#71717a') => {
          if (!statusEl) return;
          statusEl.textContent = text;
          statusEl.style.color = color;
        };

        panel.querySelectorAll<HTMLButtonElement>('[data-ko-prod-select]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const productId = btn.getAttribute('data-ko-prod-select');
            if (!productId) return;
            btn.disabled = true;
            setStatus('Selecting…', '#f59e0b');
            try {
              const t = await getTokenRef.current();
              if (!t) throw new Error('Not authenticated');
              await casesApi.updateProduct(t, caseId, productId, { isSelected: true });
              await refresh();
            } catch (err) {
              setStatus(formatApiError(err, { fallback: 'Could not select product.' }), '#DC2626');
              btn.disabled = false;
            }
          });
        });

        panel.querySelectorAll<HTMLButtonElement>('[data-ko-prod-delete]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const productId = btn.getAttribute('data-ko-prod-delete');
            if (!productId) return;
            btn.disabled = true;
            setStatus('Removing…', '#f59e0b');
            try {
              const t = await getTokenRef.current();
              if (!t) throw new Error('Not authenticated');
              await casesApi.deleteProduct(t, caseId, productId);
              await refresh();
            } catch (err) {
              setStatus(formatApiError(err, { fallback: 'Could not remove product.' }), '#DC2626');
              btn.disabled = false;
            }
          });
        });

        panel.querySelector<HTMLButtonElement>('[data-ko-prod-add]')?.addEventListener('click', async () => {
          const lender = panel.querySelector<HTMLInputElement>('[data-ko-prod="lender"]')?.value.trim() ?? '';
          const productName =
            panel.querySelector<HTMLInputElement>('[data-ko-prod="product"]')?.value.trim() ?? '';
          const rateRaw = panel.querySelector<HTMLInputElement>('[data-ko-prod="rate"]')?.value ?? '';
          const feeRaw = panel.querySelector<HTMLInputElement>('[data-ko-prod="fee"]')?.value ?? '';
          const isSelected =
            panel.querySelector<HTMLInputElement>('[data-ko-prod="selected"]')?.checked ?? false;
          if (!lender || !productName) {
            setStatus('Lender and product name are required.', '#DC2626');
            return;
          }
          setStatus('Saving product…', '#f59e0b');
          try {
            const t = await getTokenRef.current();
            if (!t) throw new Error('Not authenticated');
            await casesApi.createProduct(t, caseId, {
              lenderName: lender,
              productName,
              rate: rateRaw ? Number(rateRaw) : undefined,
              fee: feeRaw ? Number(feeRaw) : undefined,
              isSelected,
            });
            await refresh();
          } catch (err) {
            setStatus(formatApiError(err, { fallback: 'Could not add product.' }), '#DC2626');
          }
        });

        panel.querySelector<HTMLButtonElement>('[data-ko-prod-notes]')?.addEventListener('click', async () => {
          const value = panel.querySelector<HTMLTextAreaElement>('[data-ko-prod="notes"]')?.value ?? '';
          setStatus('Saving notes…', '#f59e0b');
          try {
            const t = await getTokenRef.current();
            if (!t) throw new Error('Not authenticated');
            await casesApi.update(t, caseId, { adviserNotes: value });
            if (caseDetailRef.current[caseId]) {
              caseDetailRef.current[caseId].adviserNotes = value;
            }
            await refresh();
            setStatus('Notes saved.', '#0F6E56');
          } catch (err) {
            setStatus(formatApiError(err, { fallback: 'Could not save notes.' }), '#DC2626');
          }
        });
      } catch (err) {
        panel.innerHTML = `<p style="margin:0;font-size:13px;color:#DC2626">${esc(
          formatApiError(err, { fallback: 'Could not load products.' }),
        )}</p>`;
      }
    };

    await refresh();
  }

  function renderProductRow(p: ProductConsidered, esc: (s: string) => string) {
    const rate = p.rate != null ? `${p.rate}%` : '—';
    const fee = p.fee != null ? `£${p.fee}` : '—';
    const selected = p.isSelected
      ? '<span style="color:#0F6E56;font-weight:700;font-size:11px">SELECTED</span>'
      : `<button type="button" data-ko-prod-select="${esc(p.id)}" style="padding:4px 8px;border:1px solid #e4e4e7;border-radius:6px;background:#fff;font-size:11px;font-weight:600;cursor:pointer">Select</button>`;
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #e4e4e7;border-radius:10px;background:${p.isSelected ? '#F5EEFA' : '#fff'}">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:#18181b">${esc(p.lenderName)} · ${esc(p.productName)}</div>
        <div style="font-size:12px;color:#71717a;margin-top:2px">Rate ${esc(rate)} · Fee ${esc(fee)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        ${selected}
        <button type="button" data-ko-prod-delete="${esc(p.id)}" style="padding:4px 8px;border:none;background:transparent;color:#a1a1aa;font-size:11px;cursor:pointer">Remove</button>
      </div>
    </div>`;
  }

  // ── AI report helpers ─────────────────────────────────────────────────────────
  // Prototype template keys (lowercase) → API ReportTemplate (uppercase).
  const PROTO_TPL_TO_API: Record<string, ReportTemplate> = {
    firsttime: 'FTB',      btl: 'BTL',         remortgage: 'REMORTGAGE',
    home: 'HOME_MOVER',    product: 'PRODUCT_TRANSFER',
    divorce: 'DIVORCE',    selfemployed: 'SELF_EMPLOYED',
  };
  // API case type → prototype template key (for auto-selection on case open).
  const CASE_TYPE_TO_PROTO_TPL: Record<string, string> = {
    PURCHASE: 'firsttime', REMORTGAGE: 'remortgage', BTL: 'btl',
    PRODUCT_TRANSFER: 'product', FURTHER_ADVANCE: 'remortgage',
  };

  const API_TPL_TO_PROTO: Record<string, string> = {
    FTB: 'firsttime',
    BTL: 'btl',
    REMORTGAGE: 'remortgage',
    HOME_MOVER: 'home',
    PRODUCT_TRANSFER: 'product',
    DIVORCE: 'divorce',
    SELF_EMPLOYED: 'selfemployed',
    VULNERABLE_OVERLAY: 'selfemployed',
  };

  /** Sidebar report-type labels — mirrors CD_AI_TEMPLATES in the prototype HTML. */
  const CD_AI_TEMPLATES: { key: string; label: string; wide?: boolean }[] = [
    { key: 'firsttime', label: 'First time' },
    { key: 'btl', label: 'Buy-to-let' },
    { key: 'remortgage', label: 'Remortgage' },
    { key: 'home', label: 'Home' },
    { key: 'product', label: 'Product' },
    { key: 'divorce', label: 'Divorce/Separation' },
    { key: 'selfemployed', label: 'Self employed', wide: true },
  ];

  const CD_AI_DATA_SOURCES = [
    'Fact-Find Complete',
    'Income verified',
    'Products considered',
    'Product selected',
    'Products considered',
  ];

  // ── Render a real AI suitability report into the iframe's AI Report tab ───────
  const TEMPLATE_LABELS: Record<string, string> = {
    BTL: 'Buy-to-Let', FTB: 'First-Time Buyer', REMORTGAGE: 'Remortgage',
    HOME_MOVER: 'Home Mover', PRODUCT_TRANSFER: 'Product Transfer',
    DIVORCE: 'Divorce/Separation', SELF_EMPLOYED: 'Self-Employed',
    VULNERABLE_OVERLAY: 'Vulnerable Client Overlay',
  };
  const SECTION_TITLES: Record<string, string> = {
    suitabilityAssessment: 'Suitability Assessment',
    riskWarnings: 'Risk Warnings & Disclosures',
    recommendations: 'Adviser Recommendations',
    clientIntroduction: 'Client Introduction',
    'client-introduction': 'Client Introduction',
    propertyDetails: 'Property Details & Valuation',
    'property-details': 'Property Details',
    ercAnalysis: 'ERC Analysis',
    'erc-analysis': 'ERC Analysis',
    consumerDuty: 'Risks & Consumer Duty Evidencing',
    'risks-consumer-duty': 'Risks & Consumer Duty',
  };

  // Attach iframe handlers so prototype onclick="generateCaseReport(id)" calls the live API.
  function hookAiReportHandlers(
    iwin: Window & {
      generateCaseReport?: (id: string) => void;
      regenerateCaseReportSection?: () => void;
    },
  ) {
    if (!isPersonalDashboard) return;
    iwin.generateCaseReport = (id: string) => {
      const idoc = iframeRef.current?.contentDocument;
      if (!idoc) return;
      void executeGenerateAiReport(idoc, id);
    };
    // Section regen is handled via parent capture listener (.ko-ai-regen-btn).
    iwin.regenerateCaseReportSection = () => {};
  }

  function renderAiReportPlanLocked(idoc: Document, caseId: string) {
    const body = idoc.getElementById(`cd-rpt-body-${caseId}`);
    if (!body) return;
    body.innerHTML = `<div class="cd-rpt-card" style="padding:32px 24px;text-align:center;font-family:'DM Sans',sans-serif">
      <div style="font-size:28px;margin-bottom:12px">🔒</div>
      <p style="margin:0 0 8px;font-weight:600;color:#18181b">AI Reports require Professional</p>
      <p style="margin:0;font-size:13px;color:#71717a;max-width:320px;margin-inline:auto">Upgrade to Professional to generate AI suitability reports for this case.</p>
    </div>`;
  }

  async function executeGenerateAiReport(idoc: Document, caseId: string) {
    if (!hasAiReportsRef.current) {
      renderAiReportPlanLocked(idoc, caseId);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iwin = iframeRef.current?.contentWindow as any;
    const protoState = iwin?.caseAiReportState?.[caseId] as
      | { template?: string; checklist?: boolean[]; phase?: string }
      | undefined;
    if (protoState && !protoState.checklist?.every(Boolean)) return;
    if (protoState && !protoState.template) return;

    const protoKey = protoState?.template ?? '';
    const templateType: ReportTemplate = PROTO_TPL_TO_API[protoKey] ?? 'REMORTGAGE';
    const rptBody = idoc.getElementById(`cd-rpt-body-${caseId}`);
    if (rptBody) {
      rptBody.innerHTML = `<div class="cd-rpt-card"><div class="cd-rpt-loading"><div class="spinner"></div><div class="cd-rpt-loading-text">Generating AI suitability report…</div></div></div>`;
    }

    try {
      const token = await getTokenRef.current();
      if (!token) {
        if (rptBody) {
          rptBody.innerHTML = `<div class="cd-rpt-card" style="padding:24px;text-align:center;color:#ef4444;font-size:13px">Authentication required. Please sign in.</div>`;
        }
        return;
      }
      const result = await aiApi.generateReport(token, { caseId, templateType });
      if (protoState) protoState.phase = 'generated';
      renderAiReportBody(idoc, caseId, result.data);
      void refreshAiHubFromApi(idoc);
      const freshTl = await casesApi.timeline(token, caseId).catch(() => null);
      if (freshTl) {
        queryClient.setQueryData(['cases', caseId, 'timeline'], freshTl);
        renderTimelineTrack(idoc, freshTl.data);
      }
    } catch (err) {
      if (rptBody) {
        const message = isApiErrorCode(err, API_ERROR_CODES.PLAN_LIMIT_EXCEEDED)
          ? 'AI Reports require a Professional or Enterprise plan.'
          : formatApiError(err, { fallback: 'Failed to generate report. Please try again.' });
        rptBody.innerHTML = `<div class="cd-rpt-card" style="padding:24px;text-align:center;color:#ef4444;font-size:13px">${message}</div>`;
      }
    }
  }

  function renderAiReportBody(idoc: Document, caseId: string, report: AiReport) {
    const body = idoc.getElementById(`cd-rpt-body-${caseId}`);
    if (!body) return;

    const sectionEntries = normalizeAiReportSections(report.sections);
    const isApproved = report.status === 'APPROVED' || report.status === 'FINALISED';
    const caseSnap = caseDetailRef.current[caseId];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iwin = iframeRef.current?.contentWindow as any;
    const protoState = (iwin?.caseAiReportState?.[caseId] ?? {}) as {
      template?: string;
      notifyEmail?: boolean;
      notifySms?: boolean;
    };
    const activeTemplateKey =
      protoState.template ?? API_TPL_TO_PROTO[report.templateType] ?? 'remortgage';

    const escHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const escJs = (s: string) =>
      s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');

    const product = {
      lender: caseSnap?.selectedLender ?? '',
      product: caseSnap?.selectedProduct ?? '',
      rate: caseSnap?.selectedRate != null ? `${caseSnap.selectedRate}%` : '',
      payment: caseSnap?.loanAmount != null ? `£${caseSnap.loanAmount.toLocaleString('en-GB')}` : '',
      notes: caseSnap?.adviserNotes ?? '',
    };

    const typeListHtml = CD_AI_TEMPLATES.filter((t) => !t.wide)
      .map(
        (t) =>
          `<div class="cd-rpt-type-item ${activeTemplateKey === t.key ? 'cd-rpt-type-item--active' : ''}" onclick="selectCaseReportTemplate('${escHtml(caseId)}', '${t.key}', null)">${escHtml(t.label)}</div>`,
      )
      .join('');

    const dsHtml = CD_AI_DATA_SOURCES.map(
      (label) =>
        `<div class="cd-rpt-ds-row"><span class="cd-rpt-ds-label">${escHtml(label)}</span><input type="checkbox" class="cd-rpt-ds-check" checked disabled aria-label="${escHtml(label)}"></div>`,
    ).join('');

    const sectionsHtml = sectionEntries
      .map((section, i) => {
        const open = i === 0 ? ' is-open' : '';
        const collapsed = i === 0 ? '' : ' collapsed';
        const title = section.title || SECTION_TITLES[section.id] || section.id;
        const bodyText = section.content;
        const flagLabel =
          section.complianceFlag === 'REVIEW_REQUIRED' ? '⚠ Review required' : '✓ Compliant';
        const regenBtn = isApproved
          ? ''
          : `<button type="button" class="cd-rpt-sec-btn cd-rpt-sec-btn--regen ko-ai-regen-btn" data-report-id="${escHtml(report.id)}" data-section-key="${escHtml(section.id)}" onclick="event.stopPropagation()">↻ Regenerate</button>`;
        const editBtn = `<button type="button" class="cd-rpt-sec-btn" onclick="event.stopPropagation();openEditor('${escJs(title)}', '${escJs(bodyText)}')">✎ Edit</button>`;
        return `<div class="cd-rpt-section${open}">
      <div class="cd-rpt-section-head" onclick="toggleCaseReportSection(this)">
        <span class="cd-rpt-section-title">${escHtml(title)}</span>
        <div class="cd-rpt-section-actions">
          <span class="cd-rpt-compliant">${flagLabel}</span>
          ${regenBtn}
          ${editBtn}
          <span class="cd-rpt-chevron">▼</span>
        </div>
      </div>
      <div class="cd-rpt-section-body${collapsed}">${escHtml(bodyText)}</div>
    </div>`;
      })
      .join('');

    const approveBtn = isApproved
      ? `<button type="button" class="cd-rpt-btn-approve" disabled style="opacity:0.5;cursor:default">✓ Report Approved</button>`
      : `<button type="button" class="cd-rpt-btn-approve ko-ai-approve-btn" data-report-id="${escHtml(report.id)}" data-case-id="${escHtml(caseId)}">✓ Approve and Finalise</button>`;

    const exportBtn = report.pdfUrl
      ? `<a href="${escHtml(report.pdfUrl)}" target="_blank" rel="noopener noreferrer" class="cd-rpt-btn-export" style="display:inline-flex;align-items:center;text-decoration:none">Download Final PDF</a>`
      : `<button type="button" class="cd-rpt-btn-export ko-ai-export-btn" data-report-id="${escHtml(report.id)}" data-case-id="${escHtml(caseId)}">Export Draft to PDF</button>`;

    body.innerHTML = `<div class="cd-rpt-generated">
    <div class="cd-rpt-sidebar">
      <div class="cd-rpt-side-panel cd-rpt-side-panel--types">
        <h4 class="cd-rpt-side-title">Report type</h4>
        ${typeListHtml}
      </div>
      <div class="cd-rpt-side-panel cd-rpt-side-panel--sources">
        <h4 class="cd-rpt-side-title">Data sources</h4>
        ${dsHtml}
        <div class="cd-rpt-notify">
          <div class="cd-rpt-notify-label">Notify client on approval</div>
          <label class="cd-rpt-notify-opt"><input type="checkbox" ${protoState.notifyEmail !== false ? 'checked' : ''} onchange="setCaseReportNotify('${escHtml(caseId)}', 'email', this.checked)"> Email suitability report</label>
          <label class="cd-rpt-notify-opt"><input type="checkbox" ${protoState.notifySms ? 'checked' : ''} onchange="setCaseReportNotify('${escHtml(caseId)}', 'sms', this.checked)"> SMS summary</label>
        </div>
      </div>
    </div>
    <div class="cd-rpt-main-col">
      <div class="cd-rpt-panel">
        <h3 class="cd-rpt-panel-title">Product selection record</h3>
        <div class="cd-rpt-product-grid">
          <div class="cd-rpt-field"><label>Selected lender</label><input type="text" value="${escHtml(product.lender)}" readonly></div>
          <div class="cd-rpt-field"><label>Product name</label><input type="text" value="${escHtml(product.product)}" readonly></div>
          <div class="cd-rpt-field"><label>Initial rate</label><input type="text" value="${escHtml(product.rate)}" readonly></div>
          <div class="cd-rpt-field"><label>Monthly payment</label><input type="text" value="${escHtml(product.payment)}" readonly></div>
        </div>
        <div class="cd-rpt-field"><label>Adviser research notes</label><textarea readonly>${escHtml(product.notes)}</textarea></div>
      </div>
      <div class="cd-rpt-panel">
        <div class="cd-rpt-ai-banner">
          <div class="cd-rpt-ai-banner-text">
            <p class="cd-rpt-ai-banner-title">Your AI report</p>
            <p class="cd-rpt-ai-banner-sub">Model Instance: Gemini 1.5 Flash (Pay-per-case credits offset)</p>
          </div>
          <img src="/marketing/258726584_9c50a840-de4e-4d0e-b4d3-3d10c7e73295%201%20(1).png" class="cd-rpt-ai-banner-img" alt="AI Report">
        </div>
        <div id="cd-rpt-sections-${escHtml(caseId)}">${sectionsHtml}</div>
      </div>
      <div class="cd-rpt-footer">
        <div class="cd-rpt-footer-actions">
          ${approveBtn}
          ${exportBtn}
        </div>
        <div class="cd-rpt-footer-msg">
          <input type="text" class="cd-rpt-footer-input" placeholder="Send a message to the client" aria-label="Message to client">
          <button type="button" class="cd-rpt-footer-send" onclick="switchMsgThread('${escHtml(caseId)}')">
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M3 4h10v7H5l-2 2V4Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            Send Message
          </button>
        </div>
      </div>
    </div>
  </div>`;
  }

  const iframeLoading = !iframeSrc;
  // Show the iframe as soon as src is set — don't wait for onLoad on a large HTML document.
  const iframeVisible = Boolean(iframeSrc);

  return (
    <div
      className={`flex w-full flex-col bg-brand-bg lg:flex-row ${
        factFindOpen ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-dvh'
      }`}
    >
      {uploadModal && (
        <IframeUploadModal
          caseId={uploadModal.caseId || null}
          onClose={() => setUploadModal(null)}
          onUploaded={async (doc) => {
            // Capture caseId BEFORE clearing the modal state.
            const activeCaseId = doc.caseId || uploadModal?.caseId;
            setUploadModal(null);
            if (!activeCaseId) return;
            try {
              const token = await getToken();
              if (!token) return;
              const fresh = await documentsApi.list(token, { caseId: activeCaseId, page: 1, perPage: 100 });
              const idoc = iframeRef.current?.contentDocument;
              if (idoc) renderDocsTable(idoc, fresh.data, activeCaseId);
            } catch {
              // Non-critical — table will refresh on next case open.
            }
          }}
        />
      )}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-sm font-bold text-gray-900">Log out?</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600">
                You will be signed out of KO Platform on this device. Any unsaved work in open forms may be lost.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  void handleProfileLogout();
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Mobile top bar (logo only, visible below lg) ──────────────────── */}
      <div className="sticky top-0 z-30 flex items-center border-b border-[#E4E4E4] bg-white px-4 py-3 lg:hidden">
        <Link href="/" className="flex cursor-pointer items-center gap-2" aria-label="Go to home">
          <div className="rounded-md bg-brand-teal p-1.5">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-brand-teal">KO Platform</span>
        </Link>
      </div>

        <aside
          className="hidden w-full shrink-0 flex-col items-start gap-[136px] border-b border-[#E4E4E4] bg-white py-[27px] pr-[14px] pl-[14px] lg:flex lg:sticky lg:top-0 lg:min-h-dvh lg:w-[254px] lg:self-start lg:border-r lg:border-b-0"
          aria-label="Demo navigation"
        >
          <Link href="/" className="flex cursor-pointer items-center gap-2 text-left" aria-label="Go to home">
            <div className="rounded-md bg-brand-teal p-1.5">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-brand-teal">KO Platform</span>
          </Link>

          <nav className="flex w-full flex-col items-start gap-[19px] self-stretch">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = 'icon' in item ? item.icon : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`flex w-full items-center gap-2 self-stretch rounded-[32px] px-[14px] py-[6px] text-left text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'border border-[#00B8D9] bg-[#E9FCFF] text-[#061F18]'
                      : 'border border-transparent bg-white text-[#061F18] hover:bg-[#fafafa]'
                  }`}
                >
                  <span
                    className={`flex shrink-0 items-center gap-2 rounded-[34px] p-2 ${
                      isActive ? 'bg-[rgba(255,255,255,0.95)]' : 'bg-[rgba(242,242,242,0.95)]'
                    }`}
                  >
                    {'iconUrl' in item ? (
                      <img src={item.iconUrl} alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
                    ) : Icon ? (
                      <Icon
                        className="h-6 w-6 shrink-0"
                        style={{ color: isActive ? '#00B8D9' : '#535e5b' }}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                  {isPersonalDashboard && item.id === 'messages' && !hasMessages && (
                    <span className="ml-auto text-xs text-[#71717a]" aria-label="Upgrade required">🔒</span>
                  )}
                  {isPersonalDashboard && item.id === 'ai' && !hasAiReports && (
                    <span className="ml-auto text-xs text-[#71717a]" aria-label="Upgrade required">🔒</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className={`min-w-0 flex-1 ${factFindOpen ? 'min-h-0 overflow-hidden' : ''}`}>
          <div
            className={`mx-auto w-full max-w-7xl px-0 pt-0 lg:px-6 lg:pt-6 ${
              factFindOpen ? 'pb-0 lg:pb-0 h-full min-h-0' : 'pb-24 lg:pb-10'
            }`}
          >
          {/* Notification bell + profile header row */}
          <div className="relative mb-2 flex justify-end px-4 pt-4 lg:px-0 lg:pt-0">
          <div className="flex items-center gap-2">
          <div ref={notifRef} className="relative z-30">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((o) => !o);
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-colors hover:bg-gray-50"
              aria-label={notifUnread > 0 ? `Notifications, ${notifUnread} unread` : 'Notifications'}
              aria-expanded={notifOpen}
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {notifUnread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
                  {notifUnread > 99 ? '99+' : notifUnread}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-[300px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <span className="text-sm font-semibold text-gray-900">Messages</span>
                  <button
                    type="button"
                    onClick={() => void handleMarkAllNotifsRead()}
                    disabled={notifUnread === 0 || markingNotifsRead || markingAllNotifs}
                    className="text-xs text-brand-teal hover:underline disabled:cursor-default disabled:opacity-40 disabled:no-underline"
                  >
                    Mark all as read
                  </button>
                </div>
                <ul className="max-h-[320px] divide-y divide-gray-50 overflow-y-auto">
                  {notificationItems.length === 0 ? (
                    <li className="px-4 py-6 text-center text-xs text-gray-400">
                      {isPersonalDashboard && !hasMessages
                        ? 'Messaging is not on your plan'
                        : 'No unread messages'}
                    </li>
                  ) : (
                    notificationItems.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => void handleNotifItemClick(n)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: n.color }}
                          >
                            {n.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-gray-900">{n.name}</span>
                              <span className="shrink-0 text-[10px] text-gray-400">{n.time}</span>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-gray-500">{n.preview}</p>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="border-t border-gray-100 px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => { selectTab('messages'); setNotifOpen(false); }}
                    className="text-xs font-medium text-brand-teal hover:underline"
                  >
                    View all messages →
                  </button>
                </div>
              </div>
            )}
          </div>
          <div ref={profileRef} className="relative z-30">
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              aria-label="Profile menu"
              aria-expanded={profileOpen}
            >
              {profileInitial}
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-12 w-[180px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
                <div className="border-b border-gray-100 px-4 py-3 text-xs font-medium text-gray-500">
                  Account
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setLogoutConfirmOpen(true);
                  }}
                  className="block w-full px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
          </div>
          </div>
          {/* ── Mobile: back button when on a Settings-nested tab ───────────── */}
          {(activeTab === 'ai' || activeTab === 'calculator') && (
            <button
              type="button"
              onClick={() => selectTab('settings')}
              className="mb-4 flex items-center gap-1.5 px-4 text-sm font-medium text-brand-teal lg:hidden lg:px-0"
              aria-label="Back to Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
              Settings
            </button>
          )}

          {/* Keep Calculator/Settings mounted (hidden) after first open — avoids remount reload. */}
          {calculatorMounted && (
            <div className={activeTab === 'calculator' ? undefined : 'hidden'} aria-hidden={activeTab !== 'calculator'}>
              <MortgageCalculators />
            </div>
          )}
          {settingsMounted && (
            <div className={activeTab === 'settings' ? undefined : 'hidden'} aria-hidden={activeTab !== 'settings'}>
              {/* ── Mobile: quick-access cards for non-nav tabs ──────────────── */}
              <div className="mb-5 grid grid-cols-2 gap-3 px-4 lg:hidden lg:px-0">
                <button
                  type="button"
                  onClick={() => selectTab('ai')}
                  className="flex items-center gap-3 rounded-xl border border-[#E4E4E4] bg-white px-4 py-3.5 text-left transition-colors hover:border-[#00B8D9] hover:bg-[#E9FCFF]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0fafb]">
                    <img src="/assets/smart_toy.svg" alt="" width={20} height={20} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#061F18]">AI Reports</p>
                    <p className="text-[11px] text-[#71717a]">Generate reports</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => selectTab('calculator')}
                  className="flex items-center gap-3 rounded-xl border border-[#E4E4E4] bg-white px-4 py-3.5 text-left transition-colors hover:border-[#00B8D9] hover:bg-[#E9FCFF]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0fafb]">
                    <CalculatorIcon className="h-5 w-5 text-[#535e5b]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#061F18]">Calculator</p>
                    <p className="text-[11px] text-[#71717a]">Mortgage tools</p>
                  </div>
                </button>
              </div>
              <div className="px-4 lg:px-0">
                <IntegrationsSettingsPanel embedded />
              </div>
            </div>
          )}
          {/* Keep iframe mounted across Settings/Calculator so Overview does not reload. */}
          <div className={showEmbeddedPanel ? 'hidden' : 'relative'}>
              {iframeLoading && (
                <div
                  className="absolute inset-0 z-10 flex min-h-[min(70vh,560px)] flex-col items-center justify-center gap-4 rounded-lg border border-gray-100 bg-white/95 px-6 backdrop-blur-sm"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
                  <p className="text-sm font-medium text-gray-600">
                    {isPersonalDashboard && displayName
                      ? `${timeGreeting()}, ${displayName} — loading your dashboard…`
                      : 'Loading live demo…'}
                  </p>
                  <div className="h-32 w-full max-w-md animate-pulse rounded-md bg-gray-100" />
                </div>
              )}
              {iframeSrc && (
                <iframe
                  key={isPersonalDashboard ? 'dashboard-live' : 'demo-shell'}
                  ref={iframeRef}
                  src={iframeSrc}
                  title="KO Platform Live Demo Prototype"
                  className={`block w-full border-0 transition-opacity duration-150 ${iframeVisible ? 'opacity-100' : 'opacity-0'} ${
                    factFindOpen ? 'rounded-none lg:rounded-xl' : ''
                  }`}
                  style={{ height: `${frameHeight}px` }}
                  scrolling="no"
                  loading="eager"
                  onLoad={() => {
                    try {
                      const idoc = iframeRef.current?.contentDocument;
                      if (idoc) {
                        if (isPersonalDashboard) preparePersonalDashboardIframe(idoc);
                      }
                    } catch {
                      // same-origin expected
                    }

                    setIframeLoaded(true);

                    // Sync cached bootstrap data immediately — don't wait for effects/timeouts.
                    if (isPersonalDashboard) {
                      postPersonalGreeting();
                      syncLiveDataToIframe();
                      postOverviewStats();
                    }

                    window.setTimeout(() => {
                      if (isPersonalDashboard) {
                        // Re-sync in case refs updated between onLoad and this tick.
                        syncLiveDataToIframe();
                        postOverviewStats();
                        const idoc = iframeRef.current?.contentDocument;
                        if (idoc) {
                          const iwin = iframeRef.current?.contentWindow as Window & {
                            generateCaseReport?: (id: string) => void;
                          };
                          if (iwin) hookAiReportHandlers(iwin);
                          if (hasMessagesRef.current) void refreshMessagesHubFromApi(idoc);
                          else renderMessagesHubPlanLocked(idoc);
                          void refreshAiHubFromApi(idoc);
                        }
                      }
                    }, 0);

                    // ── Iframe augmentation (same-origin, direct DOM) ───────────────
                    // The parent runs in the same origin as the iframe, so we can
                    // manipulate the iframe's DOM directly — no injected scripts or
                    // postMessage roundtrips needed.
                    try {
                      const idoc = iframeRef.current?.contentDocument;
                      if (idoc) {
                        // ── Mobile messages styles — injected fresh on every load ──────
                        // Injecting here bypasses any browser cache on the static HTML.
                        const mobileStyle = idoc.createElement('style');
                        mobileStyle.id = 'ko-mobile-msg-styles';
                        mobileStyle.textContent = [
                          '.msg-hub-thread-back{display:none;width:36px;height:36px;align-items:center;justify-content:center;border:none;background:transparent;cursor:pointer;color:#18181b;padding:0;flex-shrink:0;border-radius:8px}',
                          '.msg-hub-thread-back:hover{background:#f4f4f5}',
                          '.msg-hub-thread-hd-av{display:none;width:40px;height:40px;border-radius:50%;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0}',
                          '@media(max-width:700px){',
                          '.msg-hub-stats{grid-template-columns:repeat(2,1fr)!important}',
                          '.msg-hub-thread-col{position:fixed!important;inset:0!important;z-index:200!important;width:100%!important;border-left:none!important;overflow:hidden!important}',
                          '.msg-hub-thread-hd{align-items:center!important;gap:12px!important}',
                          '.msg-hub-thread-back{display:flex!important}',
                          '.msg-hub-thread-close{display:none!important}',
                          '.msg-hub-thread-hd-av{display:flex!important}',
                          '.msg-hub-thread-name{font-size:16px!important;font-weight:700!important}',
                          '.msg-hub-bbl{max-width:78%!important}',
                          '.msg-hub-composer-input{border-radius:999px!important;padding:11px 18px!important}',
                          '.msg-hub-composer-send{width:42px!important;height:42px!important;border-radius:50%!important;padding:0!important;justify-content:center!important}',
                          '.msg-hub-send-text{display:none!important}',
                          '}',
                        ].join('');
                        idoc.head.appendChild(mobileStyle);

                        const iwinOverview = idoc.defaultView as Window & {
                          koRefreshOverviewMobilePipeline?: () => void;
                        };
                        iwinOverview?.koRefreshOverviewMobilePipeline?.();

                        idoc.addEventListener('click', async (e: MouseEvent) => {
                          const target = e.target as HTMLElement;

                          // ── Messages: case-detail composer send ─────────────────
                          // Prefer wireMessageComposer (data-ko-wired); skip duplicate path.
                          const caseSendBtn = target.closest('.cd-msg-composer-btn--send') as HTMLElement | null;
                          if (caseSendBtn) {
                            if (caseSendBtn.getAttribute('data-ko-wired') === '1') return;
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            if (!hasMessagesRef.current) {
                              window.alert('Messages require a Professional or Enterprise plan.');
                              return;
                            }
                            const casePanel = caseSendBtn.closest('[id^="caseview-msgs-"]') as HTMLElement | null;
                            const input = casePanel?.querySelector<HTMLInputElement>('.cd-msg-composer-input');
                            const caseId = casePanel?.id.replace('caseview-msgs-', '') ?? activeCaseIdRef.current;
                            const body = input?.value.trim() ?? '';
                            if (!caseId || !body) return;
                            if (input) input.value = '';
                            const threadKey = threadKeyForCase(caseId);
                            const pendingId = `optimistic-${crypto.randomUUID()}`;
                            addOptimisticMessage(threadKey, {
                              id: pendingId,
                              orgId: '',
                              body,
                              channel: 'IN_APP',
                              direction: 'OUTBOUND',
                              sourceType: 'CASE_UPDATE',
                              isRead: false,
                              createdAt: new Date().toISOString(),
                              caseId,
                            });
                            renderMessagesThread(idoc, caseId);
                            try {
                              const token = await getTokenRef.current();
                              if (!token) {
                                dropOptimisticMessage(threadKey, pendingId);
                                renderMessagesThread(idoc, caseId);
                                window.alert('Authentication required. Please sign in and try again.');
                                return;
                              }
                              const result = await messagesApi.send(token, {
                                body,
                                caseId,
                                sourceType: 'CASE_UPDATE',
                              });
                              notifyDeliveryIssues(result.meta);
                              if (result.data) confirmOptimisticMessage(threadKey, pendingId, result.data);
                              else dropOptimisticMessage(threadKey, pendingId);
                              renderMessagesThread(idoc, caseId);
                              void refreshMessagesHubFromApi(idoc);
                            } catch (err) {
                              dropOptimisticMessage(threadKey, pendingId);
                              renderMessagesThread(idoc, caseId);
                              window.alert(formatMessageSendError(err));
                            }
                            return;
                          }

                          // ── Messages hub tab: thread reply send ─────────────────
                          const hubSendBtn = target.closest('.msg-send-btn') as HTMLElement | null;
                          if (hubSendBtn) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            const inputArea = hubSendBtn.closest('.msg-input-area') as HTMLElement | null;
                            const input = inputArea?.querySelector<HTMLTextAreaElement>('.msg-input');
                            const body = input?.value.trim() ?? '';
                            if (!body) return;
                            if (input) input.value = '';
                            try {
                              const token = await getTokenRef.current();
                              if (!token) {
                                window.alert('Authentication required. Please sign in and try again.');
                                return;
                              }
                              const result = await messagesApi.send(token, {
                                body,
                                caseId: activeCaseIdRef.current || undefined,
                                sourceType: 'SYSTEM',
                              });
                              notifyDeliveryIssues(result.meta);
                              const threadBody = idoc.querySelector<HTMLElement>('#msg-thread-area .msg-thread-body');
                              if (threadBody) {
                                const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                                const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                                const row = idoc.createElement('div');
                                row.className = 'msg-bubble-wrap outbound';
                                row.innerHTML = `<div class="msg-avatar-sm" style="background:var(--teal-100);color:var(--teal-800)">ME</div><div><div class="msg-bubble outbound">${esc(body)}</div><div class="msg-bubble-time">${now}</div></div>`;
                                threadBody.appendChild(row);
                                threadBody.scrollTop = threadBody.scrollHeight;
                              }
                            } catch (err) {
                              window.alert(formatMessageSendError(err));
                            }
                            return;
                          }

                          const liveHubRow = target.closest('.ko-msg-hub-row') as HTMLElement | null;
                          if (liveHubRow) {
                            e.preventDefault();
                            e.stopPropagation();
                            const threadKey = liveHubRow.getAttribute('data-thread-key');
                            if (!threadKey) return;
                            renderHubThreadPanel(idoc, threadKey);
                            const threadMsgs = hubMessagesRef.current[threadKey] ?? [];
                            const unreadIds = threadMsgs
                              .filter(
                                (m) =>
                                  !m.isRead &&
                                  (m.direction === 'INBOUND' || m.direction === 'SYSTEM'),
                              )
                              .map((m) => m.id);
                            if (unreadIds.length) {
                              applyMessagesReadToCache(queryClient, unreadIds);
                              for (const msg of threadMsgs) {
                                if (unreadIds.includes(msg.id)) msg.isRead = true;
                              }
                              try {
                                const token = await getTokenRef.current();
                                if (token) {
                                  await Promise.allSettled(
                                    unreadIds.map((id) => messagesApi.markRead(token, id)),
                                  );
                                }
                              } finally {
                                void queryClient.invalidateQueries({ queryKey: ['messages'] });
                                await refreshMessagesHubFromApi(idoc);
                              }
                            }
                            return;
                          }

                          const hubComposerSend = target.closest('.msg-hub-composer-send') as HTMLElement | null;
                          if (hubComposerSend) {
                            e.preventDefault();
                            e.stopPropagation();
                            const threadKey = hubComposerSend.getAttribute('data-thread-key');
                            if (!threadKey) return;
                            const input = idoc.querySelector<HTMLInputElement>(`.msg-hub-composer-input[data-thread-key="${threadKey}"]`);
                            const body = input?.value.trim() ?? '';
                            if (!body) return;
                            if (input) input.value = '';
                            const threadMsgs = hubMessagesRef.current[threadKey] ?? [];
                            const caseId = threadMsgs.find((m) => m.caseId)?.caseId;
                            const pendingId = `optimistic-${crypto.randomUUID()}`;
                            addOptimisticMessage(threadKey, {
                              id: pendingId,
                              orgId: '',
                              body,
                              channel: 'IN_APP',
                              direction: 'OUTBOUND',
                              sourceType: 'CASE_UPDATE',
                              isRead: false,
                              createdAt: new Date().toISOString(),
                              caseId: caseId ?? undefined,
                              clientId: threadMsgs[0]?.clientId,
                            });
                            // Ensure hub meta exists for render.
                            if (!hubMetaRef.current[threadKey] && caseId) {
                              const c = casesDataRef.current.find((k) => k.id === caseId);
                              hubMetaRef.current[threadKey] = {
                                name: c?.client
                                  ? `${c.client.firstName} ${c.client.lastName}`
                                  : 'Client conversation',
                                caseRef: c?.referenceNumber ?? '—',
                                caseSub: c?.type?.replace(/_/g, ' ') ?? 'General',
                                stage: c?.stage?.replace(/_/g, ' ') ?? 'Enquiry',
                                type: 'client',
                              };
                            }
                            renderHubThreadPanel(idoc, threadKey);
                            try {
                              const token = await getTokenRef.current();
                              if (!token) {
                                dropOptimisticMessage(threadKey, pendingId);
                                renderHubThreadPanel(idoc, threadKey);
                                return;
                              }
                              const result = await messagesApi.send(token, {
                                body,
                                caseId: caseId ?? undefined,
                                sourceType: 'CASE_UPDATE',
                              });
                              notifyDeliveryIssues(result.meta);
                              if (result.data) confirmOptimisticMessage(threadKey, pendingId, result.data);
                              else dropOptimisticMessage(threadKey, pendingId);
                              renderHubThreadPanel(idoc, threadKey);
                              void refreshMessagesHubFromApi(idoc);
                            } catch (err) {
                              dropOptimisticMessage(threadKey, pendingId);
                              renderHubThreadPanel(idoc, threadKey);
                              window.alert(formatMessageSendError(err));
                            }
                            return;
                          }

                          const closeHub = target.closest('.msg-hub-thread-close, .msg-hub-thread-back') as HTMLElement | null;
                          if (closeHub) {
                            const panel = idoc.getElementById('msg-hub-thread');
                            if (panel) {
                              panel.style.display = 'none';
                              panel.innerHTML = '';
                            }
                            return;
                          }

                          // ── Upload + button ──────────────────────────────────
                          if (target.closest('.cd-docs-upload')) {
                            const detailRoot = idoc.getElementById('case-detail-content');
                            let caseId = '';
                            if (detailRoot) {
                              const visible = detailRoot.querySelector('[id^="caseview-"]');
                              if (visible) {
                                const match = visible.id.match(/^caseview-[^-]+-(.+)$/);
                                if (match) caseId = match[1];
                              }
                            }
                            setUploadModal({ caseId });
                            return;
                          }

                          // ── AI: Regenerate section button ────────────────────
                          const regenBtn = target.closest('.ko-ai-regen-btn') as HTMLElement | null;
                          if (regenBtn) {
                            e.preventDefault();
                            e.stopPropagation();
                            const reportId = regenBtn.getAttribute('data-report-id');
                            const sectionKey = regenBtn.getAttribute('data-section-key');
                            if (!reportId || !sectionKey) return;
                            const origText = regenBtn.textContent ?? '↻ Regenerate';
                            regenBtn.textContent = '↻ Regenerating…';
                            regenBtn.setAttribute('disabled', 'true');
                            try {
                              const token = await getTokenRef.current();
                              if (!token) return;
                              const result = await aiApi.regenerateSection(token, {
                                reportId,
                                sectionId: sectionKey,
                              });
                              // Patch only that section's body text in the DOM.
                              const sectionBodyEl = regenBtn.closest('.cd-rpt-section')?.querySelector('.cd-rpt-section-body');
                              const updated = normalizeAiReportSections(result.data.sections).find(
                                (s) => s.id === sectionKey,
                              );
                              const newContent = updated?.content ?? '';
                              if (sectionBodyEl) sectionBodyEl.textContent = newContent;
                              const flagEl = regenBtn.closest('.cd-rpt-section')?.querySelector('.cd-rpt-compliant');
                              if (flagEl && updated?.complianceFlag === 'REVIEW_REQUIRED') {
                                flagEl.textContent = '⚠ Review required';
                              }
                            } catch {
                              // Silently restore on error.
                            } finally {
                              regenBtn.textContent = origText;
                              regenBtn.removeAttribute('disabled');
                            }
                          }

                          // ── AI: Approve & Finalise button ────────────────────
                          const approveBtn = target.closest('.ko-ai-approve-btn') as HTMLElement | null;
                          if (approveBtn) {
                            e.preventDefault();
                            e.stopPropagation();
                            const reportId = approveBtn.getAttribute('data-report-id');
                            const caseId = approveBtn.getAttribute('data-case-id') || activeCaseIdRef.current;
                            if (!reportId || !caseId) return;
                            approveBtn.textContent = 'Approving…';
                            approveBtn.setAttribute('disabled', 'true');
                            try {
                              const token = await getTokenRef.current();
                              if (!token) return;
                              const result = await aiApi.approveReport(token, reportId);
                              renderAiReportBody(idoc, caseId, result.data);
                              void refreshAiHubFromApi(idoc);
                              // Update timeline to show the approval event.
                              const freshTl = await casesApi.timeline(token, caseId).catch(() => null);
                              if (freshTl) {
                                queryClient.setQueryData(['cases', caseId, 'timeline'], freshTl);
                                renderTimelineTrack(idoc, freshTl.data);
                              }
                            } catch {
                              approveBtn.textContent = '✓ Approve and Finalise';
                              approveBtn.removeAttribute('disabled');
                            }
                          }

                          // ── AI: Export Draft to PDF ─────────────────────────
                          const exportBtnEl = target.closest('.ko-ai-export-btn') as HTMLElement | null;
                          if (exportBtnEl) {
                            e.preventDefault();
                            e.stopPropagation();
                            const reportId = exportBtnEl.getAttribute('data-report-id');
                            if (!reportId) return;
                            const origText = exportBtnEl.textContent ?? 'Export Draft to PDF';
                            exportBtnEl.textContent = 'Generating PDF…';
                            exportBtnEl.setAttribute('disabled', 'true');
                            try {
                              const token = await getTokenRef.current();
                              if (!token) {
                                exportBtnEl.textContent = origText;
                                exportBtnEl.removeAttribute('disabled');
                                return;
                              }
                              await aiApi.exportDraftPdf(token, reportId);
                            } catch {
                              // Restore label; user can retry.
                            } finally {
                              exportBtnEl.textContent = origText;
                              exportBtnEl.removeAttribute('disabled');
                            }
                          }
                        }, true);
                        idoc.addEventListener('keydown', (e: KeyboardEvent) => {
                          if (e.key !== 'Enter' || e.shiftKey) return;
                          const targetEl = e.target as HTMLElement | null;
                          if (!targetEl) return;
                          const msgInput = targetEl.closest('.cd-msg-composer-input');
                          if (msgInput) {
                            e.preventDefault();
                            const send = idoc.querySelector<HTMLElement>('.cd-msg-composer-btn--send');
                            send?.click();
                            return;
                          }
                          const hubInput = targetEl.closest('.msg-input');
                          if (hubInput) {
                            e.preventDefault();
                            const send = idoc.querySelector<HTMLElement>('.msg-send-btn');
                            send?.click();
                          }
                        }, true);
                      }
                    } catch {
                      // Guard — should never fire for same-origin iframes.
                    }
                  }}
                />
              )}
          </div>
          </div>
        </section>

      {/* ── Mobile bottom navigation bar ─────────────────────────────────── */}
      <nav
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-[#E4E4E4] bg-white lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch">
          {mobileNavItems.map((item) => {
            // AI Reports and Calculator are nested under Settings on mobile.
            const mobileActive =
              activeTab === 'ai' || activeTab === 'calculator' ? 'settings' : activeTab;
            const isActive = mobileActive === item.id;
            const Icon = 'icon' in item ? item.icon : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[#00B8D9]' : 'text-[#71717a]'
                }`}
              >
                {'iconUrl' in item ? (
                  <img
                    src={item.iconUrl}
                    alt=""
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px]"
                    style={isActive ? { filter: MOBILE_ICON_ACTIVE_FILTER } : undefined}
                  />
                ) : Icon ? (
                  <Icon
                    className="h-[22px] w-[22px]"
                    style={{ color: isActive ? '#00B8D9' : '#71717a' }}
                    aria-hidden
                  />
                ) : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
