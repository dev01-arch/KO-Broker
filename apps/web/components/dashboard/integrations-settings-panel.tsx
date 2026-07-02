'use client';

import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  LogOut,
  Phone,
  Settings,
  Shield,
} from 'lucide-react';
import { SystemStatusPanel } from '@/components/dashboard/system-status-panel';
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
};

export function IntegrationsSettingsPanel({ embedded = false }: IntegrationsSettingsPanelProps) {
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

  return (
    <div className={embedded ? 'mx-auto w-full max-w-3xl' : ''}>
      {!embedded && (
        <div className="flex h-[52px] items-center gap-3 border-b border-ink-20 bg-white px-7">
          <Settings className="h-5 w-5 text-brand-teal-500" />
          <h1 className="font-heading text-[15px] font-bold text-ink">Settings</h1>
        </div>
      )}

      <div className={embedded ? 'px-1 py-2' : 'max-w-2xl p-7'}>
        {embedded && (
          <div className="mb-6 flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-teal-500" />
            <h1 className="font-heading text-xl font-bold text-ink">Settings</h1>
          </div>
        )}

        {!isAdmin && (
          <div className="mb-5 rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-ink-60">
            Integration settings are read-only. An admin role is required to make changes.
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

        <div className="space-y-8">
          <section>
            <h2 className="mb-1 font-heading text-lg font-bold text-ink">Organization Setup</h2>
            <p className="mb-5 text-sm text-ink-60">
              Add advisers to this organization so they can be assigned to cases.
            </p>
            <div className="space-y-6 rounded-xl border border-ink-20 bg-white p-6">
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
                  <div className="px-4 py-4 text-sm text-ink-60">Loading advisers…</div>
                ) : advisers.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-ink-60">No advisers added yet.</div>
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
          </section>

          <section>
            <h2 className="mb-1 font-heading text-lg font-bold text-ink">Messaging</h2>
            <p className="mb-5 text-sm text-ink-60">
              Configure which delivery channels are available when advisers send messages.
            </p>
            <div className="space-y-4 rounded-xl border border-ink-20 bg-white p-6">
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
          </section>

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
                <p className="mb-5 text-sm text-ink-60">
                  Credit and identity verification during fact-find.
                </p>
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

          <section>
            <h2 className="mb-1 font-heading text-lg font-bold text-ink">Account</h2>
            <p className="mb-5 text-sm text-ink-60">
              Sign out of KO Platform on this device.
            </p>
            <div className="rounded-xl border border-ink-20 bg-white p-6">
              {userLoaded && user && (
                <p className="mb-4 text-sm text-ink-60">
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
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                {signingOut ? 'Signing out…' : 'Log out'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
