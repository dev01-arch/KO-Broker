'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  LogOut,
  MessageSquare,
  Phone,
  Settings,
  Shield,
  User,
} from 'lucide-react';
import { SystemStatusPanel } from '@/components/dashboard/system-status-panel';
import { BillingSettingsSection } from '@/components/dashboard/billing-settings-section';
import {
  emptyIntegrationsDraft,
  emptyMessagingDraft,
  useIntegrations,
  useMessagingSettings,
  useAdvisers,
  useCreateAdviser,
  useUpdateIntegrations,
  useUpdateMessagingSettings,
  type IntegrationsDraft,
  type MessagingDraft,
} from '@/hooks/use-settings';
import { formatApiError } from '@/lib/api/client';
import { useIsAdmin } from '@/hooks/use-org';

/** Hidden from the UI — code retained for future admin tooling. */
const SHOW_ARCHIVED_SECTIONS = false;

type SettingsSection = 'organization' | 'messaging' | 'billing' | 'account';

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof Building2;
  containerBg: string;
  iconColor: string;
}[] = [
  {
    id: 'organization',
    label: 'Organization',
    icon: Building2,
    containerBg: '#E9FCFF',
    iconColor: '#00B8D9',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    containerBg: '#FFF5E0',
    iconColor: '#CE652D',
  },
  {
    id: 'messaging',
    label: 'Messaging',
    icon: MessageSquare,
    containerBg: '#F0FDF4',
    iconColor: '#16A34A',
  },
  {
    id: 'account',
    label: 'Account',
    icon: User,
    containerBg: '#F4F4F5',
    iconColor: '#52525B',
  },
];

function EnabledToggle({
  label,
  description,
  enabled,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-ink-20 bg-ink-08/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink-60">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
          enabled ? 'bg-brand-teal-500' : 'bg-ink-20',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

type IntegrationsSettingsPanelProps = {
  embedded?: boolean;
  initialSection?: SettingsSection;
};

export function IntegrationsSettingsPanel({
  embedded = false,
  initialSection = 'organization',
}: IntegrationsSettingsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingParam = searchParams.get('billing');
  const billingNotice =
    billingParam === 'success' || billingParam === 'cancel' ? billingParam : null;
  const sectionParam = searchParams.get('section');
  const { signOut } = useClerk();
  const { user, isLoaded: userLoaded } = useUser();
  const isAdmin = useIsAdmin();
  const { data: integrationsData, isLoading: integrationsLoading, error: integrationsError } =
    useIntegrations();
  const { data: messagingData, isLoading: messagingLoading, error: messagingError } =
    useMessagingSettings();
  const { mutateAsync: saveIntegrations, isPending: savingIntegrations } = useUpdateIntegrations();
  const { mutateAsync: saveMessaging, isPending: savingMessaging } = useUpdateMessagingSettings();
  const { data: advisersData, isLoading: advisersLoading, error: advisersError } = useAdvisers();
  const { mutateAsync: createAdviser, isPending: creatingAdviser } = useCreateAdviser();

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [integrationsDraft, setIntegrationsDraft] = useState<IntegrationsDraft>(
    emptyIntegrationsDraft(),
  );
  const [messagingDraft, setMessagingDraft] = useState<MessagingDraft>(emptyMessagingDraft());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [adviserDraft, setAdviserDraft] = useState({ firstName: '', lastName: '', email: '' });

  useEffect(() => {
    if (billingNotice) {
      setActiveSection('billing');
      return;
    }
    if (sectionParam && SETTINGS_SECTIONS.some((section) => section.id === sectionParam)) {
      setActiveSection(sectionParam as SettingsSection);
      return;
    }
    setActiveSection(initialSection);
  }, [billingNotice, initialSection, sectionParam]);

  function handleBillingNoticeDismiss() {
    router.replace('/dashboard/settings?section=billing');
  }

  useEffect(() => {
    if (integrationsData?.data) {
      setIntegrationsDraft(emptyIntegrationsDraft(integrationsData.data));
    }
  }, [integrationsData]);

  useEffect(() => {
    if (messagingData?.data) {
      setMessagingDraft(emptyMessagingDraft(messagingData.data));
    }
  }, [messagingData]);

  const isLoading = integrationsLoading || messagingLoading;
  const saving = savingIntegrations || savingMessaging;
  const advisers = advisersData?.data ?? [];
  const activeMeta = SETTINGS_SECTIONS.find((section) => section.id === activeSection)!;

  async function handleIntegrationToggle(integration: 'equifax' | 'twilio', enabled: boolean) {
    setIntegrationsDraft((prev) => ({ ...prev, [integration]: { enabled } }));
    setSaveSuccess(false);
    setError(null);
    setSavingKey(integration);
    try {
      await saveIntegrations({ [integration]: { enabled } });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setIntegrationsDraft((prev) => ({
        ...prev,
        [integration]: { enabled: !enabled },
      }));
      setError(formatApiError(err, { fallback: 'Failed to save settings. Please try again.' }));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleMessagingToggle(
    channel: keyof MessagingDraft,
    enabled: boolean,
  ) {
    setMessagingDraft((prev) => ({ ...prev, [channel]: { enabled } }));
    setSaveSuccess(false);
    setError(null);
    setSavingKey(channel);
    try {
      await saveMessaging({ [channel]: { enabled } });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setMessagingDraft((prev) => ({
        ...prev,
        [channel]: { enabled: !enabled },
      }));
      setError(formatApiError(err, { fallback: 'Failed to save settings. Please try again.' }));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: '/' });
    } catch {
      setSigningOut(false);
      setError('Could not sign out. Please try again.');
    }
  }

  async function handleCreateAdviser() {
    setError(null);
    setSaveSuccess(false);
    try {
      await createAdviser({
        firstName: adviserDraft.firstName.trim(),
        lastName: adviserDraft.lastName.trim(),
        email: adviserDraft.email.trim(),
      });
      setAdviserDraft({ firstName: '', lastName: '', email: '' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Failed to add adviser. Please try again.' }));
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center text-ink-60 ${embedded ? 'min-h-[50vh]' : 'min-h-[60vh]'}`}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Loading settings…</span>
      </div>
    );
  }

  const loadMessage =
    integrationsError || messagingError || advisersError
      ? formatApiError(integrationsError ?? messagingError ?? advisersError, { fallback: 'Failed to load settings.' })
      : null;

  const statusAlerts = (
    <>
      {!isAdmin && (
        <div className="mb-5 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-ink-60">
          Some settings are read-only. An admin role is required to make changes.
        </div>
      )}
      {(error || loadMessage) && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-red/10 px-4 py-3 text-sm text-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error ?? loadMessage}
        </div>
      )}
      {saveSuccess && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-brand-teal-50 px-4 py-3 text-sm text-brand-teal-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Settings saved.
        </div>
      )}
    </>
  );

  const organizationSection = (
    <div className="space-y-6">
      <p className="text-sm text-ink-60">
        Add organization members so they can be assigned as advisers on new clients and cases.
      </p>
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={adviserDraft.firstName}
            onChange={(e) => setAdviserDraft((prev) => ({ ...prev, firstName: e.target.value }))}
            placeholder="First name"
            className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          />
          <input
            value={adviserDraft.lastName}
            onChange={(e) => setAdviserDraft((prev) => ({ ...prev, lastName: e.target.value }))}
            placeholder="Last name"
            className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          />
          <input
            type="email"
            value={adviserDraft.email}
            onChange={(e) => setAdviserDraft((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
            className="rounded-lg border border-ink-20 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-teal-500 focus:ring-2 focus:ring-brand-teal-500/20"
          />
        </div>
        <div>
          <button
            type="button"
            disabled={
              !isAdmin ||
              creatingAdviser ||
              !adviserDraft.firstName.trim() ||
              !adviserDraft.lastName.trim() ||
              !adviserDraft.email.trim()
            }
            onClick={() => void handleCreateAdviser()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingAdviser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {creatingAdviser ? 'Adding adviser…' : 'Add adviser'}
          </button>
        </div>
        <div className="rounded-lg border border-ink-20">
          <div className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-3 border-b border-ink-20 bg-ink-08 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-60">
            <span>First name</span>
            <span>Last name</span>
            <span>Email</span>
            <span>Status</span>
          </div>
          {advisersLoading ? (
            <div className="px-4 py-4 text-sm text-ink-60">Loading members…</div>
          ) : advisers.length === 0 ? (
            <div className="px-4 py-4 text-sm text-ink-60">No members added yet.</div>
          ) : (
            advisers.map((adviser) => (
              <div key={adviser.id} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-3 border-b border-ink-20 px-4 py-3 text-sm text-ink last:border-b-0">
                <span>{adviser.firstName ?? '—'}</span>
                <span>{adviser.lastName ?? '—'}</span>
                <span className="text-ink-60">{adviser.email}</span>
                <span className={adviser.isActive ? 'text-green-700' : 'text-ink-60'}>
                  {adviser.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const messagingSection = (
    <div className="space-y-4">
      <p className="text-sm text-ink-60">
        Configure which delivery channels are available when advisers send messages.
      </p>
      <EnabledToggle
        label="In-app messages"
        description="Show messages in the dashboard thread and client portal."
        enabled={messagingDraft.inApp.enabled}
        disabled={!isAdmin || (saving && savingKey === 'inApp')}
        onChange={(enabled) => void handleMessagingToggle('inApp', enabled)}
      />
      <EnabledToggle
        label="Email"
        description="Send a copy to the client's email address (via Resend)."
        enabled={messagingDraft.email.enabled}
        disabled={!isAdmin || (saving && savingKey === 'email')}
        onChange={(enabled) => void handleMessagingToggle('email', enabled)}
      />
      <EnabledToggle
        label="SMS"
        description="Send a text to the client's mobile number (via Twilio)."
        enabled={messagingDraft.sms.enabled}
        disabled={!isAdmin || (saving && savingKey === 'sms')}
        onChange={(enabled) => void handleMessagingToggle('sms', enabled)}
      />
    </div>
  );

  const accountSection = (
    <div className="space-y-4">
      <p className="text-sm text-ink-60">Sign out of KO Platform on this device.</p>
      {userLoaded && user && (
        <p className="text-sm text-ink-60">
          Signed in as{' '}
          <span className="font-medium text-ink">
            {user.primaryEmailAddress?.emailAddress ?? user.fullName ?? 'your account'}
          </span>
        </p>
      )}
      <button
        type="button"
        disabled={signingOut}
        onClick={() => void handleSignOut()}
        className="inline-flex items-center gap-2 rounded-lg border border-red/40 bg-red px-4 py-2.5 text-sm font-medium text-white hover:bg-red/90 disabled:opacity-50"
      >
        {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {signingOut ? 'Signing out…' : 'Log out'}
      </button>
    </div>
  );

  const archivedSections = SHOW_ARCHIVED_SECTIONS ? (
    <>
      <section>
        <h2 className="mb-1 font-heading text-lg font-bold text-ink">Integrations</h2>
        <p className="mb-5 text-sm text-ink-60">
          Turn third-party services on or off for credit checks and platform SMS delivery.
        </p>
        <div className="space-y-6">
          <div className="rounded-xl border border-ink-20 bg-white p-6">
            <div className="mb-1 flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-teal-500" />
              <h3 className="font-heading text-sm font-bold text-ink">Equifax</h3>
            </div>
            <p className="mb-5 text-sm text-ink-60">Credit and identity verification during fact-find.</p>
            <EnabledToggle
              label="Enable Equifax"
              description="Run credit checks when a case moves into research."
              enabled={integrationsDraft.equifax.enabled}
              disabled={!isAdmin || (saving && savingKey === 'equifax')}
              onChange={(enabled) => void handleIntegrationToggle('equifax', enabled)}
            />
          </div>
          <div className="rounded-xl border border-ink-20 bg-white p-6">
            <div className="mb-1 flex items-center gap-2">
              <Phone className="h-4 w-4 text-brand-teal-500" />
              <h3 className="font-heading text-sm font-bold text-ink">Twilio</h3>
            </div>
            <p className="mb-5 text-sm text-ink-60">
              Platform SMS provider. Required for SMS delivery when enabled above.
            </p>
            <EnabledToggle
              label="Enable Twilio"
              description="Allow SMS notifications to be sent from this organisation."
              enabled={integrationsDraft.twilio.enabled}
              disabled={!isAdmin || (saving && savingKey === 'twilio')}
              onChange={(enabled) => void handleIntegrationToggle('twilio', enabled)}
            />
          </div>
        </div>
      </section>
      <SystemStatusPanel />
    </>
  ) : null;

  function renderActiveSection() {
    switch (activeSection) {
      case 'organization':
        return organizationSection;
      case 'billing':
        return (
          <BillingSettingsSection
            billingNotice={billingNotice}
            onBillingNoticeDismiss={handleBillingNoticeDismiss}
          />
        );
      case 'messaging':
        return messagingSection;
      case 'account':
        return accountSection;
    }
  }

  const sidebarLayout = (
    <div className="w-full bg-background">
      <div className="mx-auto w-full max-w-7xl py-2">
        <div className="grid gap-8 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="sticky top-8 rounded-lg border border-ink-08 bg-card p-4">
              <h3 className="mb-3 px-2 text-sm font-semibold text-muted-foreground">SETTINGS</h3>
              <nav className="space-y-1">
                {SETTINGS_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all bg-white hover:bg-gray-50 ${
                        isActive ? 'shadow-sm ring-1 ring-ink-20' : 'border border-transparent'
                      }`}
                    >
                      <div
                        className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: section.containerBg }}
                      >
                        <Icon className="h-[14px] w-[14px]" style={{ color: section.iconColor }} />
                      </div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: isActive ? section.iconColor : '#0a0a0a' }}
                      >
                        {section.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main className="lg:col-span-9">
            <div className="overflow-hidden rounded-lg border border-ink-08 bg-card">
              <div className="border-b border-ink-08 bg-accent/50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: activeMeta.containerBg }}
                  >
                    <activeMeta.icon className="h-5 w-5" style={{ color: activeMeta.iconColor }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{activeMeta.label}</h2>
                    <p className="text-sm text-muted-foreground">Manage your workspace preferences</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {statusAlerts}
                {renderActiveSection()}
                {archivedSections}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return sidebarLayout;
  }

  return (
    <div>
      <div className="flex h-[52px] items-center gap-3 border-b border-ink-20 bg-white px-7">
        <Settings className="h-5 w-5 text-brand-teal-500" />
        <h1 className="font-heading text-[15px] font-bold text-ink">Settings</h1>
      </div>
      <div className="p-7">{sidebarLayout}</div>
    </div>
  );
}
