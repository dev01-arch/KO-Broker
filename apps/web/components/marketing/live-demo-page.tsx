'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Calculator as CalculatorIcon, FileText, Loader2, Settings, Upload, type LucideIcon } from 'lucide-react';
import MortgageCalculators from '@/components/marketing/demo-calculator/MortgageCalculators';
import { IntegrationsSettingsPanel } from '@/components/dashboard/integrations-settings-panel';
import { clientsQueryKey, useClients, useCreateClient } from '@/hooks/use-clients';
import { casesQueryKey, useCases, useCreateCase } from '@/hooks/use-cases';
import { usePlanFeature } from '@/hooks/use-org';
import { useUploadDocument } from '@/hooks/use-documents';
import { getSessionUsername } from '@/lib/auth/demo-session';
import {
  aiApi,
  casesApi,
  complianceApi,
  documentsApi,
  formatApiError,
  getApiErrorFieldMap,
  isApiErrorCode,
  API_ERROR_CODES,
  messagesApi,
  type AiReport,
  type CaseSummary,
  type CaseStage,
  type ClientSummary,
  type CreateCaseInput,
  type CreateClientInput,
  type DocumentType,
  type MessageRecord,
  type MessageChannel,
  type MessageDeliveryMeta,
  type ReportTemplate,
  type TimelineEntry,
} from '@/lib/api/client';
import { formatClientName } from '@/lib/api/client-display';

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

const LIVE_CLIENTS_QUERY = { page: 1, perPage: 100 } as const;
const LIVE_CASES_QUERY = { page: 1, perPage: 100 } as const;

type DemoTab = 'overview' | 'clients' | 'cases' | 'messages' | 'ai' | 'calculator' | 'settings';

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

type LiveDemoPageProps = {
  /** Logo link target — `/` on marketing demo, `/dashboard` when signed in. */
  homeHref?: string;
};

export function LiveDemoPage({ homeHref = '/' }: LiveDemoPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded: clerkLoaded } = useUser();
  const { getToken } = useAuth();
  const [demoUsername, setDemoUsername] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DemoTab>('overview');
  const isDashboard = homeHref === '/dashboard';
  const isClerkUser = Boolean(user);
  const [frameHeight, setFrameHeight] = useState<number>(1200);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [uploadModal, setUploadModal] = useState<{ caseId: string } | null>(null);
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
  const hubMetaRef = useRef<Record<string, { name: string; caseRef: string; caseSub: string; stage: string; type: 'client' | 'system' }>>({});
  const clientsDataRef = useRef<ClientSummary[]>([]);
  const casesDataRef = useRef<CaseSummary[]>([]);
  const clientsLoadingRef = useRef(false);
  const casesLoadingRef = useRef(false);
  const hasMessagesRef = useRef(true);
  const hasAiReportsRef = useRef(true);
  const showEmbeddedPanel = isEmbeddedPanelTab(activeTab);
  const queryClient = useQueryClient();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings') setActiveTab('settings');
  }, [searchParams]);

  /** Signed-in app at /dashboard — real API data and personalised UI. */
  const isPersonalDashboard = isDashboard && isClerkUser && clerkLoaded;
  /** Marketing /demo — always mock "Alex" content, never live API. */
  const isMockDemo = !isDashboard;

  const { data: clientsData, isLoading: clientsLoading } = useClients(LIVE_CLIENTS_QUERY, {
    enabled: isPersonalDashboard,
  });
  const { data: casesData, isLoading: casesLoading } = useCases(LIVE_CASES_QUERY, {
    enabled: isPersonalDashboard,
  });
  const { mutateAsync: createClient } = useCreateClient();
  const { mutateAsync: createCase } = useCreateCase();
  const hasMessages = usePlanFeature('messages');
  const hasAiReports = usePlanFeature('ai_reports');

  hasMessagesRef.current = hasMessages;
  hasAiReportsRef.current = hasAiReports;

  clientsDataRef.current = clientsData?.data ?? [];
  casesDataRef.current = casesData?.data ?? [];
  clientsLoadingRef.current = clientsLoading;
  casesLoadingRef.current = casesLoading;

  const postClientsSync = useCallback((clients?: ClientSummary[]) => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    iframeWindow.postMessage(
      { type: 'ko:clients-sync', clients: clients ?? clientsDataRef.current },
      window.location.origin,
    );
  }, []);

  const postCasesSync = useCallback((cases?: CaseSummary[]) => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    iframeWindow.postMessage(
      { type: 'ko:cases-sync', cases: cases ?? casesDataRef.current },
      window.location.origin,
    );
  }, []);

  const syncLiveDataToIframe = useCallback(() => {
    postClientsSync();
    postCasesSync();
  }, [postClientsSync, postCasesSync]);

  const postOverviewStats = useCallback(() => {
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    if (clientsLoadingRef.current || casesLoadingRef.current) return;

    const clientCount = clientsDataRef.current.length;
    const caseCount = casesDataRef.current.length;
    const isEmpty = clientCount === 0 && caseCount === 0;

    iframeWindow.postMessage(
      { type: 'ko:overview-empty', empty: isEmpty },
      window.location.origin,
    );

    if (!isEmpty) {
      iframeWindow.postMessage(
        {
          type: 'ko:overview-stats',
          stats: { clients: clientCount, cases: caseCount },
        },
        window.location.origin,
      );
    }
    const idoc = iframeRef.current?.contentDocument;
    if (idoc) renderPersonalOverviewSections(idoc);
  }, []);

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
      lead: 'Lead',
      factfind: 'Fact-Find',
      research: 'Recommendation',
      application: 'Application',
      completion: 'Completion',
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
            <div class="kb-cc-amt">${amount}</div>
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
  }, [isPersonalDashboard]);

  // Don't wait for clients API — iframe loads in parallel; data syncs via postMessage.
  const overviewReady = !isDashboard || !isClerkUser || clerkLoaded;

  const displayName = useMemo(() => {
    if (isMockDemo) return 'Alex';
    return resolveClerkDisplayName(user);
  }, [isMockDemo, user]);

  const iframeSrc = useMemo(() => {
    if (!overviewReady) return null;
    const params = new URLSearchParams({ embedded: '1' });
    // Personal dashboard: live API + personalised header (no mock Alex).
    if (isPersonalDashboard) {
      params.set('liveData', '1');
      params.set('personal', '1');
      params.set('tab', 'overview');
      if (displayName) params.set('userName', displayName);
      // Start at zero while live stats load; postOverviewStats updates when API data arrives.
      params.set('overviewEmpty', '1');
    } else {
      params.set('tab', activeTab);
      if (isMockDemo) params.set('userName', 'Alex');
    }
    return `/live-demo-prototype-v2a.html?${params}`;
  }, [activeTab, overviewReady, isPersonalDashboard, isMockDemo, displayName]);

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

  // Only reset load state when the iframe document actually changes (src), not on tab switches.
  useEffect(() => {
    if (showEmbeddedPanel) return;
    setIframeLoaded(false);
  }, [showEmbeddedPanel, iframeSrc]);

  useEffect(() => {
    if (showEmbeddedPanel || !iframeLoaded) return;

    const syncHeight = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
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
  }, [activeTab, iframeLoaded, showEmbeddedPanel]);

  // Personal dashboard: always greet the signed-in user (not mock Alex).
  useEffect(() => {
    if (!iframeLoaded || showEmbeddedPanel || !isPersonalDashboard || !displayName) return;
    postPersonalGreeting();
  }, [iframeLoaded, displayName, showEmbeddedPanel, isPersonalDashboard, postPersonalGreeting]);

  useEffect(() => {
    if (!iframeLoaded || !isPersonalDashboard) return;
    syncLiveDataToIframe();
    postOverviewStats();
  }, [
    iframeLoaded,
    isPersonalDashboard,
    clientsLoading,
    casesLoading,
    clientsData,
    casesData,
    syncLiveDataToIframe,
    postOverviewStats,
  ]);

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
      if (idoc && hasAiReports) void refreshAiHubFromApi(idoc);
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
        path?: string;
        payload?: CreateClientInput | CreateCaseInput;
      };

      if (data?.type === 'ko:navigate' && typeof data.path === 'string') {
        if (data.path.includes('settings')) {
          setActiveTab('settings');
          return;
        }
        router.push(data.path);
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

      if (data?.type === 'ko:open-case' && typeof data.caseId === 'string') {
        const openedCaseId = data.caseId;
        activeCaseIdRef.current = openedCaseId;
        try {
          const token = await getToken();
          if (!token) throw new Error('Not authenticated');
          const [caseResult, docsResult, tlResult, aiResult, msgsResult] = await Promise.all([
            casesApi.get(token, openedCaseId),
            documentsApi.list(token, { caseId: openedCaseId, page: 1, perPage: 100 }).catch(() => null),
            casesApi.timeline(token, openedCaseId).catch(() => null),
            hasAiReportsRef.current
              ? aiApi.listReports(token, { caseId: openedCaseId, perPage: 1 }).catch(() => null)
              : Promise.resolve(null),
            hasMessagesRef.current
              ? messagesApi.list(token, { caseId: openedCaseId, perPage: 100 }).catch(() => null)
              : Promise.resolve(null),
          ]);
          // Send case data so the iframe calls openCase(id) and renders the detail HTML.
          iframeWindow.postMessage(
            { type: 'ko:case-detail', case: caseResult.data },
            window.location.origin,
          );
          caseDetailRef.current[openedCaseId] = {
            referenceNumber: caseResult.data.referenceNumber,
            type: caseResult.data.type,
            stage: caseResult.data.stage,
            client: {
              firstName: caseResult.data.client?.firstName,
              lastName: caseResult.data.client?.lastName,
            },
            selectedLender: caseResult.data.selectedLender,
            selectedProduct: caseResult.data.selectedProduct,
            selectedRate: caseResult.data.selectedRate,
            selectedFee: caseResult.data.selectedFee,
            adviserNotes: caseResult.data.adviserNotes,
            loanAmount: caseResult.data.loanAmount,
          };
          // Wait a tick for openCase() to finish building the DOM, then populate
          // the docs table, compliance panel, timeline track, and (if exists) AI report.
          const docs = docsResult?.data ?? [];
          const tlEntries = tlResult?.data ?? [];
          const msgs = msgsResult?.data ?? [];
          const caseApiStage = caseResult.data.stage;
          const existingReport = aiResult?.data?.[0] ?? null;
          const caseType = caseResult.data.type;
          window.setTimeout(() => {
            const idoc = iframeRef.current?.contentDocument;
            if (!idoc) return;
            renderDocsTable(idoc, docs, openedCaseId);
            updateCompliancePanel(idoc, openedCaseId, caseApiStage);
            renderTimelineTrack(idoc, tlEntries);
            if (hasMessagesRef.current) {
              renderMessagesThread(idoc, openedCaseId, msgs);
            } else {
              renderMessagesPlanLocked(idoc, openedCaseId);
            }
            if (hasMessagesRef.current) void refreshMessagesHubFromApi(idoc);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const iwin = iframeRef.current?.contentWindow as any;

            // Route AI report actions through the live API (not the prototype mock).
            if (iwin) {
              hookAiReportHandlers(iwin);
            }

            if (!hasAiReportsRef.current) {
              renderAiReportPlanLocked(idoc, openedCaseId);
            } else if (existingReport) {
              renderAiReportBody(idoc, openedCaseId, existingReport);
            } else {
              // Pre-configure the AI setup panel so the Generate button is
              // immediately enabled (all checks ticked + case-type template).
              const state = iwin?.caseAiReportState?.[openedCaseId];
              if (state) {
                state.checklist = [true, true, true];
                state.template = CASE_TYPE_TO_PROTO_TPL[caseType] ?? 'remortgage';
                state.phase = 'ready';
                iwin?.refreshCaseReportUI?.(openedCaseId);
              }
            }
          }, 80);
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
          await queryClient.refetchQueries({ queryKey: ['cases'] });
          await queryClient.refetchQueries({ queryKey: ['clients'] });
          const freshCases = queryClient.getQueryData<{ data: CaseSummary[] }>(
            casesQueryKey(LIVE_CASES_QUERY),
          );
          const freshClients = queryClient.getQueryData<{ data: ClientSummary[] }>(
            clientsQueryKey(LIVE_CLIENTS_QUERY),
          );
          casesDataRef.current = freshCases?.data ?? [];
          clientsDataRef.current = freshClients?.data ?? [];
          setActiveTab('cases');
          syncLiveDataToIframe();
          replyCase({
            success: true,
            case: created,
            clientName: formatClientName(created.client),
          });
        } catch (err) {
          replyCase({ success: false, error: formatApiError(err, { fallback: 'Could not create case. Please try again.' }) });
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
        await queryClient.refetchQueries({ queryKey: ['clients'] });
        const fresh = queryClient.getQueryData<{ data: ClientSummary[] }>(
          clientsQueryKey(LIVE_CLIENTS_QUERY),
        );
        const clients = fresh?.data ?? [];
        clientsDataRef.current = clients;
        setActiveTab('clients');
        syncLiveDataToIframe();
        reply({
          success: true,
          client: {
            ...created,
            clientType: payload.clientType ?? 'INDIVIDUAL',
            companyName: payload.companyName,
            employmentStatus: payload.employmentStatus ?? 'EMPLOYED',
            annualIncome: payload.annualIncome,
            _count: { cases: 0, messages: 0 },
          },
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
  }, [isDashboard, isClerkUser, createClient, createCase, getToken, syncLiveDataToIframe, queryClient, router]);

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

  // ── Message helpers (broadcast: IN_APP · EMAIL · SMS) ────────────────────────
  const MSG_CHANNEL_LABELS: Record<MessageChannel, string> = {
    IN_APP: 'In-app',
    EMAIL: 'Email',
    SMS: 'SMS',
  };

  function msgChannelBadgeHtml(channel: MessageChannel): string {
    const mod =
      channel === 'EMAIL' ? 'msg-channel--email' : channel === 'SMS' ? 'msg-channel--sms' : 'msg-channel--inapp';
    return `<span class="msg-channel-badge ${mod}">${MSG_CHANNEL_LABELS[channel]}</span>`;
  }

  function msgChannelsBadgeHtml(channels: MessageChannel[]): string {
    return channels.map((channel) => msgChannelBadgeHtml(channel)).join(' ');
  }

  function groupMessagesForDisplay(messages: MessageRecord[]) {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    type Group = {
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
      }
    }
    return groups;
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
  function renderMessagesThread(idoc: Document, caseId: string, messages: MessageRecord[]) {
    const feed = idoc.querySelector<HTMLElement>(`#caseview-msgs-${caseId} .cd-msg-feed`);
    if (!feed) return;

    if (!hasMessagesRef.current) {
      renderMessagesPlanLocked(idoc, caseId);
      return;
    }

    const panel = idoc.querySelector(`#caseview-msgs-${caseId}`);
    const composer = panel?.querySelector<HTMLElement>('.cd-msg-composer');
    if (composer) composer.style.display = '';

    if (!messages.length) {
      feed.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#a1a1aa;font-size:13px;font-family:'DM Sans',sans-serif">No messages yet. Start the conversation below.</div>`;
    } else {
      const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let lastDate = '';
      feed.innerHTML = groupMessagesForDisplay(messages).map((group) => {
        const d = new Date(group.createdAt);
        const dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeLabel = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const dateSep = dateLabel !== lastDate ? `<div class="cd-msg-date">${dateLabel}</div>` : '';
        lastDate = dateLabel;
        const tickSvg = group.isRead
          ? `<span class="cd-msg-ticks cd-msg-ticks--blue">✓✓</span>`
          : `<span class="cd-msg-ticks cd-msg-ticks--gray">✓</span>`;
        const badges = msgChannelsBadgeHtml(group.channels);
        if (group.direction === 'OUTBOUND') {
          return `${dateSep}<div class="cd-msg-row cd-msg-row--out">
  <div class="cd-msg-bubble cd-msg-bubble--out">
    <p class="cd-msg-bubble-text">${escHtml(group.body)}</p>
    <div class="cd-msg-bubble-meta"><span>${timeLabel}</span>${badges}${tickSvg}</div>
  </div>
  ${group.isRead ? '<span class="cd-msg-sent">✓✓ Sent</span>' : ''}
</div>`;
        }
        return `${dateSep}<div class="cd-msg-row cd-msg-row--in">
  <div class="cd-msg-bubble cd-msg-bubble--in">
    <p class="cd-msg-bubble-text">${escHtml(group.body)}</p>
    <div class="cd-msg-bubble-meta"><span>${timeLabel}</span>${badges}</div>
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

    const doSend = async () => {
      const body = input.value.trim();
      if (!body) return;
      input.value = '';
      input.disabled = true;
      freshBtn.disabled = true;
      const feed = panel.querySelector<HTMLElement>('.cd-msg-feed');
      if (feed) {
        const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const bubble = idoc.createElement('div');
        bubble.className = 'cd-msg-row cd-msg-row--out';
        bubble.innerHTML = `<div class="cd-msg-bubble cd-msg-bubble--out">
  <p class="cd-msg-bubble-text">${escHtml(body)}</p>
  <div class="cd-msg-bubble-meta"><span>${now}</span><span class="cd-msg-ticks cd-msg-ticks--gray">✓</span></div>
</div>`;
        feed.appendChild(bubble);
        feed.scrollTop = feed.scrollHeight;
      }
      try {
        const token = await getTokenRef.current();
        if (!token) return;
        const result = await messagesApi.send(token, { body, caseId, sourceType: 'CASE_UPDATE' });
        notifyDeliveryIssues(result.meta);
        const fresh = await messagesApi.list(token, { caseId, perPage: 100 });
        renderMessagesThread(idoc, caseId, fresh.data);
        await refreshMessagesHubFromApi(idoc);
      } catch {
        // Leave the optimistic bubble in place — non-critical for demo.
      } finally {
        input.disabled = false;
        freshBtn.disabled = false;
        input.focus();
      }
    };

    freshBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
  }

  function renderHubThreadPanel(idoc: Document, threadKey: string) {
    const panel = idoc.getElementById('msg-hub-thread');
    if (!panel) return;
    const msgs = hubMessagesRef.current[threadKey] ?? [];
    const meta = hubMetaRef.current[threadKey];
    if (!meta) return;
    const bubbles = groupMessagesForDisplay(msgs).map((group) => {
      const tm = new Date(group.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const badges = msgChannelsBadgeHtml(group.channels);
      if (group.direction === 'OUTBOUND') {
        return `<div class="msg-hub-bbl-row msg-hub-bbl-row--out"><div class="msg-hub-bbl-col"><div class="msg-hub-bbl msg-hub-bbl--out">${group.body}</div><div class="msg-hub-bbl-time msg-hub-bbl-time--out">${badges} · ${tm}</div></div><div class="msg-hub-bbl-av" style="background:#0F6E56">AD</div></div>`;
      }
      return `<div class="msg-hub-bbl-row msg-hub-bbl-row--in"><div class="msg-hub-bbl-av" style="background:#1D9E75">CL</div><div class="msg-hub-bbl-col"><div class="msg-hub-bbl msg-hub-bbl--in">${group.body}</div><div class="msg-hub-bbl-time msg-hub-bbl-time--in">${badges} · ${tm}</div></div></div>`;
    }).join('');
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.innerHTML = `<div class="msg-hub-thread-hd">
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
    Object.values(rowsByThread).forEach((arr) => arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    hubMessagesRef.current = rowsByThread;
    hubMetaRef.current = metaByThread;
    const tbody = idoc.querySelector<HTMLTableSectionElement>('#tab-messages .msg-hub-tbl tbody');
    if (!tbody) return;
    const keys = Object.keys(rowsByThread).sort((a, b) => {
      const am = rowsByThread[a][rowsByThread[a].length - 1];
      const bm = rowsByThread[b][rowsByThread[b].length - 1];
      return new Date(bm.createdAt).getTime() - new Date(am.createdAt).getTime();
    });
    tbody.innerHTML = keys.map((k) => {
      const msgs = rowsByThread[k];
      const grouped = groupMessagesForDisplay(msgs);
      const last = grouped[grouped.length - 1];
      const meta = metaByThread[k];
      const initials = meta.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'CL';
      const t = tlTime(last.createdAt);
      const channelLabel = last.channels.map((c) => MSG_CHANNEL_LABELS[c]).join(' · ');
      return `<tr class="msg-hub-row ko-msg-hub-row" data-thread-key="${k}">
        <td><div class="msg-contact"><div class="msg-contact-av" style="background:#0F6E56">${initials}</div><div><div class="msg-contact-name">${meta.name}</div><div class="msg-contact-adviser">Live API</div></div></div></td>
        <td><div class="msg-subject-line"><span class="msg-subject-dot ${last.isRead ? 'msg-subject-dot--read' : 'msg-subject-dot--unread'}"></span>${last.subject ?? 'Message update'}</div><div class="msg-subject-preview">${msgChannelsBadgeHtml(last.channels)} ${last.body}</div></td>
        <td><div class="msg-case-ref">${meta.caseRef}</div><div class="msg-case-type">${meta.caseSub}</div></td>
        <td><span class="msg-stage msg-stage--factfind">${meta.stage}</span></td>
        <td><div class="msg-type-cell">${channelLabel}</div></td>
        <td><div class="msg-time-val">${t}</div></td>
      </tr>`;
    }).join('');
    const footer = idoc.querySelector('#tab-messages .msg-hub-footer');
    if (footer) footer.innerHTML = `<span>${keys.length} of ${keys.length} messages</span><span class="msg-hub-footer-unread">${all.data.filter((m) => !m.isRead).length} unread</span>`;

    // Update the four Messages Hub KPI cards with live aggregates.
    const totalMessages = all.data.length;
    const unreadMessages = all.data.filter((m) => !m.isRead).length;
    const actionRequired = all.data.filter(
      (m) => !m.isRead && (m.direction === 'INBOUND' || m.direction === 'SYSTEM'),
    ).length;
    // Average response time: inbound -> next outbound in same thread.
    const responseMinutes: number[] = [];
    Object.values(rowsByThread).forEach((thread) => {
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
    } catch (err) {
      if (isApiErrorCode(err, API_ERROR_CODES.PLAN_LIMIT_EXCEEDED)) {
        renderMessagesHubPlanLocked(idoc);
      }
    }
  }

  async function refreshAiHubFromApi(idoc: Document) {
    if (!isPersonalDashboard) return;
    if (!hasAiReportsRef.current) return;
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
      tbody.innerHTML =
        '<tr class="ai-rpt-empty-row"><td colspan="6">No AI reports yet — generate a report from a case to see it here.</td></tr>';
      if (subtitle) subtitle.textContent = `${clientTotal} of ${clientTotal} clients`;
      if (statTotal) statTotal.textContent = '0';
      if (statFlags) statFlags.textContent = '0';
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
    compCard.querySelectorAll('.ko-comp-advance-btn, .ko-comp-stage-info').forEach(el => el.remove());

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

    const info = idoc.createElement('p');
    info.className = 'ko-comp-stage-info';
    info.style.cssText = 'margin:16px 0 0;font-size:13px;color:#71717a;font-family:\'DM Sans\',sans-serif';
    info.textContent = next ? `Current stage: ${apiStage.replace(/_/g, ' ')}` : 'Case is at the final stage (Completion).';
    compCard.appendChild(info);
    if (!next) return;

    const btn = idoc.createElement('button');
    btn.type = 'button';
    btn.className = 'ko-comp-advance-btn';
    btn.style.cssText = 'margin-top:16px;padding:10px 24px;background:#1D9E75;color:#fff;border:none;border-radius:8px;font-family:\'DM Sans\',sans-serif;font-size:14px;font-weight:600;cursor:pointer;width:100%;box-shadow:0 4px 12px rgba(29,158,117,0.2);transition:opacity .15s';
    btn.textContent = `Advance to ${next.label} →`;

    // Direct listener — runs in parent JS context, has full access to refs and APIs.
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
        await complianceApi.advanceStage(token, { caseId, targetStage: next.toStage });
        const updated = await casesApi.get(token, caseId);
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'ko:case-detail', case: updated.data },
          window.location.origin,
        );
        // Re-fetch timeline (a new audit entry was created by the advance).
        const freshTl = await casesApi.timeline(token, caseId).catch(() => null);
        window.setTimeout(() => {
          const freshIdoc = iframeRef.current?.contentDocument;
          if (!freshIdoc) return;
          updateCompliancePanel(freshIdoc, caseId, updated.data.stage);
          if (freshTl) renderTimelineTrack(freshIdoc, freshTl.data);
          // Switch back to Compliance tab after the case re-renders on Overview.
          const compTab = freshIdoc.querySelector<HTMLElement>(`.cd-tab[onclick*="compliance-${caseId}"]`);
          compTab?.click();
        }, 80);
      } catch (err) {
        (btn as HTMLButtonElement).disabled = false;
        btn.style.opacity = '1';
        btn.textContent = `Advance to ${next.label} →`;
        window.alert(formatApiError(err, { fallback: 'Could not advance stage. Please check all compliance requirements are met.' }));
      }
    });

    compCard.appendChild(btn);
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
    propertyDetails: 'Property Details & Valuation',
    ercAnalysis: 'ERC Analysis',
    consumerDuty: 'Risks & Consumer Duty Evidencing',
  };

  // Attach iframe handlers so prototype onclick="generateCaseReport(id)" calls the live API.
  function hookAiReportHandlers(iwin: Window & { generateCaseReport?: (id: string) => void }) {
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
      | { template?: string; checklist?: boolean[] }
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
      if (freshTl) renderTimelineTrack(idoc, freshTl.data);
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

    const sections = (report.sections ?? {}) as Record<string, string>;
    const sectionEntries = Object.entries(sections);
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
      .map(([key, value], i) => {
        const open = i === 0 ? ' is-open' : '';
        const collapsed = i === 0 ? '' : ' collapsed';
        const title = SECTION_TITLES[key] ?? key.replace(/([A-Z])/g, ' $1').trim();
        const bodyText = typeof value === 'string' ? value : JSON.stringify(value);
        const regenBtn = isApproved
          ? ''
          : `<button type="button" class="cd-rpt-sec-btn cd-rpt-sec-btn--regen ko-ai-regen-btn" data-report-id="${escHtml(report.id)}" data-section-key="${escHtml(key)}" onclick="event.stopPropagation()">↻ Regenerate</button>`;
        const editBtn = `<button type="button" class="cd-rpt-sec-btn" onclick="event.stopPropagation();openEditor('${escJs(title)}', '${escJs(bodyText)}')">✎ Edit</button>`;
        return `<div class="cd-rpt-section${open}">
      <div class="cd-rpt-section-head" onclick="toggleCaseReportSection(this)">
        <span class="cd-rpt-section-title">${escHtml(title)}</span>
        <div class="cd-rpt-section-actions">
          <span class="cd-rpt-compliant">✓ Compliant</span>
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
      : `<button type="button" class="cd-rpt-btn-export">Export Draft to PDF</button>`;

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

  const iframeLoading = !iframeSrc || !iframeLoaded;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-brand-bg lg:flex-row">
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
        <aside
          className="flex w-full shrink-0 flex-col items-start gap-[136px] border-b border-[#E4E4E4] bg-white py-[27px] pr-[14px] pl-[14px] lg:sticky lg:top-0 lg:min-h-dvh lg:w-[254px] lg:self-start lg:border-r lg:border-b-0"
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
                  onClick={() => setActiveTab(item.id)}
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

        <section className="min-w-0 flex-1">
          {activeTab === 'calculator' ? (
            <div className="relative mx-auto w-full max-w-7xl px-6 pt-6 pb-10">
              <MortgageCalculators />
            </div>
          ) : activeTab === 'settings' ? (
            <div className="relative mx-auto w-full max-w-7xl px-6 pt-6 pb-10">
              <IntegrationsSettingsPanel embedded />
            </div>
          ) : (
            <div className="relative mx-auto w-full max-w-7xl px-6 pt-6 pb-10">
              {iframeLoading && (
                <div
                  className="absolute inset-0 z-10 flex min-h-[min(70vh,560px)] flex-col items-center justify-center gap-4 rounded-lg border border-gray-100 bg-white/95 px-6 backdrop-blur-sm"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" />
                  <p className="text-sm font-medium text-gray-600">Loading live demo…</p>
                  <div className="h-32 w-full max-w-md animate-pulse rounded-md bg-gray-100" />
                </div>
              )}
              {iframeSrc && (
                <iframe
                  key={isPersonalDashboard ? 'dashboard-live' : activeTab}
                  ref={iframeRef}
                  src={iframeSrc}
                  title="KO Platform Live Demo Prototype"
                  className={`block w-full border-0 transition-opacity duration-200 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
                  style={{ height: `${frameHeight}px` }}
                  scrolling="no"
                  loading="eager"
                  onLoad={() => {
                    setIframeLoaded(true);
                    window.setTimeout(() => {
                      if (isPersonalDashboard) {
                        postPersonalGreeting();
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
                          if (hasAiReportsRef.current) void refreshAiHubFromApi(idoc);
                        }
                      }
                    }, 50);

                    // ── Iframe augmentation (same-origin, direct DOM) ───────────────
                    // The parent runs in the same origin as the iframe, so we can
                    // manipulate the iframe's DOM directly — no injected scripts or
                    // postMessage roundtrips needed.
                    try {
                      const idoc = iframeRef.current?.contentDocument;
                      if (idoc) {
                        idoc.addEventListener('click', async (e: MouseEvent) => {
                          const target = e.target as HTMLElement;

                          // ── Messages: case-detail composer send ─────────────────
                          const caseSendBtn = target.closest('.cd-msg-composer-btn--send') as HTMLElement | null;
                          if (caseSendBtn) {
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
                            try {
                              const token = await getTokenRef.current();
                              if (!token) {
                                window.alert('Authentication required. Please sign in and try again.');
                                return;
                              }
                              const result = await messagesApi.send(token, {
                                body,
                                caseId,
                                sourceType: 'CASE_UPDATE',
                              });
                              notifyDeliveryIssues(result.meta);
                              const fresh = await messagesApi.list(token, { caseId, perPage: 100 });
                              renderMessagesThread(idoc, caseId, fresh.data);
                              await refreshMessagesHubFromApi(idoc);
                            } catch (err) {
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
                            const threadMsgs = hubMessagesRef.current[threadKey];
                            const caseId = threadMsgs?.[0]?.caseId;
                            try {
                              const token = await getTokenRef.current();
                              if (!token) return;
                              const result = await messagesApi.send(token, {
                                body,
                                caseId: caseId ?? undefined,
                                sourceType: 'CASE_UPDATE',
                              });
                              notifyDeliveryIssues(result.meta);
                              await refreshMessagesHubFromApi(idoc);
                              renderHubThreadPanel(idoc, threadKey);
                            } catch (err) {
                              window.alert(formatMessageSendError(err));
                            }
                            return;
                          }

                          const closeHub = target.closest('.msg-hub-thread-close') as HTMLElement | null;
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
                              const newContent = (result.data.sections as Record<string, string>)?.[sectionKey] ?? '';
                              if (sectionBodyEl) sectionBodyEl.textContent = newContent;
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
                              if (freshTl) renderTimelineTrack(idoc, freshTl.data);
                            } catch {
                              approveBtn.textContent = '✓ Approve and Finalise';
                              approveBtn.removeAttribute('disabled');
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
          )}
        </section>
    </div>
  );
}
