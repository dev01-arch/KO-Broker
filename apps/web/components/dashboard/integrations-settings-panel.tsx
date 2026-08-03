'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  ArrowLeft,
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
  useUpdateAdviser,
  useDeleteAdviser,
  useResendAdviserInvite,
  useUpdateIntegrations,
  useUpdateMessagingSettings,
  type IntegrationsDraft,
  type MessagingDraft,
} from '@/hooks/use-settings';
import { formatApiError } from '@/lib/api/client';
import { useOrgRole } from '@/hooks/use-org';

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
  const orgRole = useOrgRole();
  const roleReady = orgRole !== undefined;
  const isAdmin = orgRole === 'ADMIN';
  /** While role is loading, allow interaction; API enforces ADMIN. */
  const canEditMessaging = !roleReady || isAdmin;
  // Advisers only see Messaging + Account. Hide team/billing unless confirmed ADMIN.
  // While role is unknown, keep admin sections visible if we started on them (avoids flicker).
  const visibleSettingsSections = SETTINGS_SECTIONS.filter((section) => {
    if (section.id === 'organization' || section.id === 'billing') {
      return !roleReady || isAdmin;
    }
    return true;
  });
  const { data: integrationsData, error: integrationsError } = useIntegrations();
  const { data: messagingData, error: messagingError } = useMessagingSettings();
  const { mutateAsync: saveIntegrations, isPending: savingIntegrations } = useUpdateIntegrations();
  const { mutateAsync: saveMessaging, isPending: savingMessaging } = useUpdateMessagingSettings();
  const { data: advisersData, isLoading: advisersLoading, error: advisersError } = useAdvisers();
  const { mutateAsync: createAdviser, isPending: creatingAdviser } = useCreateAdviser();

  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    if (billingNotice) return 'billing';
    if (
      sectionParam === 'organization' ||
      sectionParam === 'messaging' ||
      sectionParam === 'billing' ||
      sectionParam === 'account'
    ) {
      return sectionParam;
    }
    return initialSection;
  });
  const [integrationsDraft, setIntegrationsDraft] = useState<IntegrationsDraft>(
    emptyIntegrationsDraft(),
  );
  const [messagingDraft, setMessagingDraft] = useState<MessagingDraft>(emptyMessagingDraft());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [adviserDraft, setAdviserDraft] = useState({ firstName: '', lastName: '', email: '' });
  const [activeAdviserId, setActiveAdviserId] = useState<string | null>(null);
  const [actionAdviserId, setActionAdviserId] = useState<string | null>(null);

  const { mutateAsync: updateAdviser, isPending: updatingAdviser } = useUpdateAdviser();
  const { mutateAsync: deleteAdviser, isPending: deletingAdviser } = useDeleteAdviser();
  const { mutateAsync: resendAdviserInvite, isPending: resendingInvite } = useResendAdviserInvite();

  // Sync section from URL only — never reset the user's selection when role hydrates.
  useEffect(() => {
    if (billingNotice && (!roleReady || isAdmin)) {
      if (isAdmin) setActiveSection('billing');
      return;
    }

    if (!sectionParam) return;

    const allowed: SettingsSection[] =
      !roleReady || isAdmin
        ? SETTINGS_SECTIONS.map((s) => s.id)
        : ['messaging', 'account'];

    if (allowed.includes(sectionParam as SettingsSection)) {
      setActiveSection(sectionParam as SettingsSection);
    }
  }, [billingNotice, sectionParam, isAdmin, roleReady]);

  // Hard redirect: advisers never stay on team/billing (wait until role is known).
  useEffect(() => {
    if (!roleReady || isAdmin) return;
    if (activeSection === 'organization' || activeSection === 'billing') {
      setActiveSection('messaging');
    }
  }, [roleReady, isAdmin, activeSection]);

  function handleBillingNoticeDismiss() {
    // Stay on the live dashboard shell when Settings is embedded.
    router.replace(
      embedded
        ? '/dashboard?tab=settings&section=billing'
        : '/dashboard/settings?section=billing',
    );
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

  // Never block the whole Settings shell — placeholders/cache paint immediately.
  // Section bodies hydrate as queries resolve.
  const saving = savingIntegrations || savingMessaging;
  // Team management lists invited advisers only; admins assign via Create Client.
  const advisers = (advisersData?.data ?? []).filter((adviser) => adviser.role !== 'ADMIN');
  const activeAdviser = activeAdviserId
    ? advisers.find((adviser) => adviser.id === activeAdviserId) ?? null
    : null;
  const activeMeta =
    visibleSettingsSections.find((section) => section.id === activeSection) ??
    visibleSettingsSections[0] ??
    SETTINGS_SECTIONS.find((section) => section.id === 'account')!;

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
      const result = await saveMessaging({ [channel]: { enabled } });
      if (result?.data) {
        setMessagingDraft(emptyMessagingDraft(result.data));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setMessagingDraft((prev) => ({
        ...prev,
        [channel]: { enabled: !enabled },
      }));
      setError(formatApiError(err, { fallback: 'Failed to save messaging settings. Please try again.' }));
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
      const result = await createAdviser({
        firstName: adviserDraft.firstName.trim(),
        lastName: adviserDraft.lastName.trim(),
        email: adviserDraft.email.trim(),
      });
      setAdviserDraft({ firstName: '', lastName: '', email: '' });
      if (result?.data && result.data.emailSent === false) {
        setError(
          result.data.emailError ||
            'Adviser was added, but the invite email failed to send. Check RESEND_API_KEY and try Resend invite.',
        );
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Failed to add adviser. Please try again.' }));
    }
  }

  async function handleUpdateAdviserById(
    id: string,
    input: {
      isActive?: boolean;
      canViewAllClients?: boolean;
      canViewAccountDetails?: boolean;
      canViewAiSummaries?: boolean;
    },
  ) {
    setError(null);
    setSaveSuccess(false);
    setActionAdviserId(id);
    try {
      await updateAdviser({ id, ...input });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Failed to update adviser.' }));
    } finally {
      setActionAdviserId(null);
    }
  }

  async function handleUpdateActiveAdviser(input: {
    isActive?: boolean;
    canViewAllClients?: boolean;
    canViewAccountDetails?: boolean;
    canViewAiSummaries?: boolean;
  }) {
    if (!activeAdviserId) return;
    await handleUpdateAdviserById(activeAdviserId, input);
  }

  async function handleResendInvite(id: string) {
    setError(null);
    setSaveSuccess(false);
    setActionAdviserId(id);
    try {
      await resendAdviserInvite(id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Failed to resend invite.' }));
    } finally {
      setActionAdviserId(null);
    }
  }

  async function handleResendActiveInvite() {
    if (!activeAdviserId) return;
    await handleResendInvite(activeAdviserId);
  }

  async function handleDeleteActiveAdviser() {
    if (!activeAdviserId) return;
    setError(null);
    setSaveSuccess(false);
    try {
      await deleteAdviser(activeAdviserId);
      setActiveAdviserId(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setError(formatApiError(err, { fallback: 'Failed to delete adviser.' }));
    }
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
        {activeAdviser ? (
          <div className="rounded-lg border border-ink-20 bg-white p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => setActiveAdviserId(null)}
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-teal-700 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to organization
              </button>
            </div>

            <div className="rounded-xl border border-ink-20 bg-white p-4">
              <h2 className="font-heading text-xl font-bold text-ink">
                {[activeAdviser.firstName, activeAdviser.lastName].filter(Boolean).join(' ') || activeAdviser.email}
              </h2>
              <p className="mt-1 text-sm text-ink-60">{activeAdviser.email}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-medium ${
                    activeAdviser.isActive ? 'bg-green/10 text-green' : 'bg-ink-08 text-ink-60'
                  }`}
                >
                  {activeAdviser.isActive ? 'Active' : 'Inactive'}
                </span>
                {activeAdviser.invitePending && (
                  <span className="rounded-full bg-amber/10 px-2.5 py-0.5 font-medium text-amber">
                    Invite pending
                  </span>
                )}
              </div>
            </div>

            <section className="mt-4 space-y-3 rounded-xl border border-ink-20 bg-white p-6">
              <h3 className="font-heading text-sm font-bold text-ink">Access permissions</h3>
              <p className="text-sm text-ink-60">Control what this adviser can see across the organisation.</p>

              <EnabledToggle
                label="View all clients"
                description="When off, advisers only see clients on cases assigned to them."
                enabled={activeAdviser.canViewAllClients ?? false}
                disabled={!isAdmin || updatingAdviser}
                onChange={(enabled) => void handleUpdateActiveAdviser({ canViewAllClients: enabled })}
              />
              <EnabledToggle
                label="View account details"
                description="Allow access to billing and sensitive account information."
                enabled={activeAdviser.canViewAccountDetails ?? false}
                disabled={!isAdmin || updatingAdviser}
                onChange={(enabled) => void handleUpdateActiveAdviser({ canViewAccountDetails: enabled })}
              />
              <EnabledToggle
                label="View AI summaries"
                description="Allow access to AI-generated case and client summaries."
                enabled={activeAdviser.canViewAiSummaries ?? false}
                disabled={!isAdmin || updatingAdviser}
                onChange={(enabled) => void handleUpdateActiveAdviser({ canViewAiSummaries: enabled })}
              />
              <EnabledToggle
                label="Active account"
                description="Deactivate to prevent adviser login."
                enabled={activeAdviser.isActive}
                disabled={!isAdmin || updatingAdviser}
                onChange={(enabled) => void handleUpdateActiveAdviser({ isActive: enabled })}
              />

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {activeAdviser.invitePending && (
                  <button
                    type="button"
                    disabled={resendingInvite}
                    onClick={() => void handleResendActiveInvite()}
                    className="inline-flex items-center gap-2 rounded-lg border border-brand-teal-300 bg-brand-teal-50 px-3 py-2 text-xs font-medium text-brand-teal-700 hover:bg-brand-teal-100 disabled:opacity-50"
                  >
                    {resendingInvite ? 'Resending…' : 'Resend invite'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={!isAdmin || updatingAdviser}
                  onClick={() =>
                    void handleUpdateActiveAdviser({ isActive: !activeAdviser.isActive })
                  }
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${
                    activeAdviser.isActive
                      ? 'border-ink-20 bg-white text-ink hover:bg-ink-08'
                      : 'border-brand-teal-300 bg-brand-teal-50 text-brand-teal-700 hover:bg-brand-teal-100'
                  }`}
                >
                  {updatingAdviser && actionAdviserId === activeAdviser.id
                    ? activeAdviser.isActive
                      ? 'Deactivating…'
                      : 'Activating…'
                    : activeAdviser.isActive
                      ? 'Deactivate'
                      : 'Activate'}
                </button>

                {!activeAdviser.isActive && (
                  <button
                    type="button"
                    disabled={!isAdmin || deletingAdviser}
                    onClick={() => void handleDeleteActiveAdviser()}
                    className="inline-flex items-center gap-2 rounded-lg border border-red/40 bg-red/10 px-3 py-2 text-xs font-medium text-red hover:bg-red/20 disabled:opacity-50"
                  >
                    {deletingAdviser ? 'Deleting…' : 'Delete adviser'}
                  </button>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-ink-20">
            <table className="w-full table-fixed border-collapse text-sm text-ink">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[18%]" />
                <col className="w-[36%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-ink-20 bg-ink-08 text-left text-xs font-semibold uppercase tracking-wide text-ink-60">
                  <th className="px-3 py-2.5 font-semibold">First name</th>
                  <th className="px-3 py-2.5 font-semibold">Last name</th>
                  <th className="px-3 py-2.5 font-semibold">Email</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {advisersLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-sm text-ink-60">
                      Loading members…
                    </td>
                  </tr>
                ) : advisers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-sm text-ink-60">
                      No members added yet.
                    </td>
                  </tr>
                ) : (
                  advisers.map((adviser) => {
                    const rowBusy = actionAdviserId === adviser.id;
                    return (
                      <tr key={adviser.id} className="border-b border-ink-20 last:border-b-0">
                        <td className="px-3 py-3 align-middle">
                          <div className="truncate">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => setActiveAdviserId(adviser.id)}
                                className="font-medium text-brand-teal-700 hover:underline"
                              >
                                {adviser.firstName ?? '—'}
                              </button>
                            ) : (
                              (adviser.firstName ?? '—')
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="truncate">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => setActiveAdviserId(adviser.id)}
                                className="font-medium text-brand-teal-700 hover:underline"
                              >
                                {adviser.lastName ?? '—'}
                              </button>
                            ) : (
                              (adviser.lastName ?? '—')
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="truncate text-ink-60" title={adviser.email}>
                            {adviser.email}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                                adviser.isActive
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-ink-08 text-ink-60'
                              }`}
                            >
                              {adviser.isActive ? 'Active' : 'Inactive'}
                            </span>
                            {adviser.invitePending && (
                              <span className="inline-flex whitespace-nowrap rounded-full bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber">
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex flex-nowrap items-center gap-2">
                            {isAdmin && adviser.invitePending && (
                              <button
                                type="button"
                                disabled={rowBusy || resendingInvite}
                                onClick={() => void handleResendInvite(adviser.id)}
                                className="shrink-0 rounded-md border border-brand-teal-300 bg-brand-teal-50 px-2.5 py-1 text-xs font-medium text-brand-teal-700 hover:bg-brand-teal-100 disabled:opacity-50"
                              >
                                {rowBusy && resendingInvite ? 'Resending…' : 'Resend invite'}
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                disabled={rowBusy || updatingAdviser}
                                onClick={() =>
                                  void handleUpdateAdviserById(adviser.id, {
                                    isActive: !adviser.isActive,
                                  })
                                }
                                className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                                  adviser.isActive
                                    ? 'border-ink-20 bg-white text-ink hover:bg-ink-08'
                                    : 'border-brand-teal-300 bg-brand-teal-50 text-brand-teal-700 hover:bg-brand-teal-100'
                                }`}
                              >
                                {rowBusy && updatingAdviser
                                  ? adviser.isActive
                                    ? 'Deactivating…'
                                    : 'Activating…'
                                  : adviser.isActive
                                    ? 'Deactivate'
                                    : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const messagingSection = (
    <div className="space-y-4">
      <p className="text-sm text-ink-60">
        Control how message notifications are delivered. Turning email off also cancels any
        pending LinkedIn-style notification digests.
      </p>
      <EnabledToggle
        label="In-app messages"
        description="Allow messages in the dashboard thread and client portal."
        enabled={messagingDraft.inApp.enabled}
        disabled={!canEditMessaging || (saving && savingKey === 'inApp')}
        onChange={(enabled) => void handleMessagingToggle('inApp', enabled)}
      />
      <EnabledToggle
        label="Email notifications"
        description="Send delayed notification emails when a message is waiting (preview only, via Resend)."
        enabled={messagingDraft.email.enabled}
        disabled={!canEditMessaging || (saving && savingKey === 'email')}
        onChange={(enabled) => void handleMessagingToggle('email', enabled)}
      />
      <EnabledToggle
        label="SMS"
        description="Send a text to the client's mobile number (via Twilio)."
        enabled={messagingDraft.sms.enabled}
        disabled={!canEditMessaging || (saving && savingKey === 'sms')}
        onChange={(enabled) => void handleMessagingToggle('sms', enabled)}
      />
      {!canEditMessaging && orgRole !== undefined && (
        <p className="text-xs text-ink-60">Only organisation admins can change messaging settings.</p>
      )}
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
    // Advisers: Messaging + Account only (never render team/billing content).
    if (!isAdmin) {
      if (activeSection === 'account') return accountSection;
      return messagingSection;
    }

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
                {visibleSettingsSections.map((section) => {
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
