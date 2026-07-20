'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, UserCog } from 'lucide-react';
import {
  useAdviser,
  useResendAdviserInvite,
  useUpdateAdviser,
} from '@/hooks/use-settings';
import { useIsAdmin } from '@/hooks/use-org';
import { formatApiError } from '@/lib/api/client';

function PermissionToggle({
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

export default function AdviserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const adviserId = params.id;

  const { data, isLoading, error } = useAdviser(adviserId, { enabled: isAdmin });
  const { mutateAsync: updateAdviser, isPending: saving } = useUpdateAdviser(adviserId);
  const { mutateAsync: resendInvite, isPending: resending } = useResendAdviserInvite(adviserId);

  const adviser = data?.data;

  async function patch(input: Parameters<typeof updateAdviser>[0]) {
    if (!isAdmin) return;
    await updateAdviser(input);
  }

  if (!isAdmin) {
    return (
      <div className="p-7">
        <p className="text-sm text-ink-60">Only organisation admins can manage advisers.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading adviser…
      </div>
    );
  }

  if (error || !adviser) {
    return (
      <div className="p-7">
        <p className="text-sm text-red">
          {formatApiError(error, { fallback: 'Adviser not found.' })}
        </p>
        <Link
          href="/dashboard/settings?section=organization"
          className="mt-4 inline-flex text-sm font-medium text-brand-teal-700 hover:underline"
        >
          Back to settings
        </Link>
      </div>
    );
  }

  const displayName =
    [adviser.firstName, adviser.lastName].filter(Boolean).join(' ') || adviser.email;

  return (
    <div>
      <div className="flex h-[52px] items-center gap-3 border-b border-ink-20 bg-white px-7">
        <UserCog className="h-5 w-5 text-brand-teal-500" />
        <h1 className="font-heading text-[15px] font-bold text-ink">Adviser settings</h1>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 p-7">
        <button
          type="button"
          onClick={() => router.push('/dashboard/settings?section=organization')}
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-teal-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organization
        </button>

        <div className="rounded-xl border border-ink-20 bg-white p-6">
          <h2 className="font-heading text-xl font-bold text-ink">{displayName}</h2>
          <p className="mt-1 text-sm text-ink-60">{adviser.email}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-0.5 font-medium ${
                adviser.isActive ? 'bg-green/10 text-green' : 'bg-ink-08 text-ink-60'
              }`}
            >
              {adviser.isActive ? 'Active' : 'Inactive'}
            </span>
            {adviser.invitePending && (
              <span className="rounded-full bg-amber/10 px-2.5 py-0.5 font-medium text-amber">
                Invite pending
              </span>
            )}
          </div>
        </div>

        <section className="space-y-3 rounded-xl border border-ink-20 bg-white p-6">
          <h3 className="font-heading text-sm font-bold text-ink">Access permissions</h3>
          <p className="text-sm text-ink-60">
            Control what this adviser can see across the organisation.
          </p>

          <PermissionToggle
            label="View all clients"
            description="When off, advisers only see clients on cases assigned to them."
            enabled={adviser.canViewAllClients ?? false}
            disabled={saving}
            onChange={(enabled) => void patch({ canViewAllClients: enabled })}
          />
          <PermissionToggle
            label="View account details"
            description="Allow access to billing and sensitive account information."
            enabled={adviser.canViewAccountDetails ?? false}
            disabled={saving}
            onChange={(enabled) => void patch({ canViewAccountDetails: enabled })}
          />
          <PermissionToggle
            label="View AI summaries"
            description="Allow access to AI-generated case and client summaries."
            enabled={adviser.canViewAiSummaries ?? false}
            disabled={saving}
            onChange={(enabled) => void patch({ canViewAiSummaries: enabled })}
          />
          <PermissionToggle
            label="Active account"
            description="Inactive advisers cannot sign in but their history is retained."
            enabled={adviser.isActive}
            disabled={saving}
            onChange={(enabled) => void patch({ isActive: enabled })}
          />
        </section>

        {adviser.invitePending && (
          <section className="rounded-xl border border-ink-20 bg-white p-6">
            <h3 className="font-heading text-sm font-bold text-ink">Invite</h3>
            <p className="mt-1 text-sm text-ink-60">
              Resend the onboarding email if they have not accepted yet.
            </p>
            <button
              type="button"
              disabled={resending}
              onClick={() => void resendInvite()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-teal-300 bg-brand-teal-50 px-4 py-2 text-sm font-medium text-brand-teal-700 hover:bg-brand-teal-100 disabled:opacity-50"
            >
              {resending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Resend invite
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
