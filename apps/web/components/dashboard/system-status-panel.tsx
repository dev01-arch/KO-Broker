'use client';

import { useState } from 'react';
import { Activity, CheckCircle2, ChevronDown, Loader2, Server, XCircle } from 'lucide-react';
import { useHealth } from '@/hooks/use-system';
import { formatApiError } from '@/lib/api/client';

function ServiceRow({
  label,
  healthy,
  loading,
}: {
  label: string;
  healthy: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-ink-20 bg-ink-08/40 px-4 py-3">
      <span className="text-sm font-medium text-ink">{label}</span>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-ink-60" aria-label="Checking" />
      ) : healthy ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-teal-700">
          <CheckCircle2 className="h-4 w-4" />
          Operational
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red">
          <XCircle className="h-4 w-4" />
          Unavailable
        </span>
      )}
    </div>
  );
}

function WebhookUrlRow({ label, path }: { label: string; path: string }) {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const url = origin ? `${origin}${path}` : path;

  return (
    <div className="rounded-lg border border-ink-20 bg-ink-08/40 px-4 py-3">
      <p className="text-sm font-medium text-ink">{label}</p>
      <code className="mt-1 block break-all text-xs text-ink-60">{url}</code>
    </div>
  );
}

export function SystemStatusPanel() {
  const [open, setOpen] = useState(true);
  const { data: health, isLoading, isError, error } = useHealth();

  const overallHealthy = health?.status === 'ok';

  return (
    <section>
      <button
        type="button"
        id="system-status-toggle"
        aria-expanded={open}
        aria-controls="system-status-panel"
        onClick={() => setOpen((prev) => !prev)}
        className="mb-1 flex w-full items-center justify-between gap-3 rounded-lg text-left transition-colors hover:bg-ink-08/60 -mx-1 px-1 py-1"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 shrink-0 text-brand-teal-500" />
          <h2 className="font-heading text-lg font-bold text-ink">System status</h2>
          {!open && !isLoading && (
            <span
              className={[
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                isError || !overallHealthy
                  ? 'bg-red/10 text-red'
                  : 'bg-brand-teal-50 text-brand-teal-700',
              ].join(' ')}
            >
              {isError || !overallHealthy ? 'Degraded' : 'Healthy'}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <p className="mb-5 text-sm text-ink-60">
        Live health of core platform services. Polled every 5 minutes.
      </p>

      <div
        id="system-status-panel"
        role="region"
        aria-labelledby="system-status-toggle"
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 rounded-xl border border-ink-20 bg-white p-6">
        <div className="flex items-center justify-between gap-4 border-b border-ink-20 pb-4">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-brand-teal-500" />
            <span className="text-sm font-medium text-ink">API</span>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-ink-60" aria-label="Checking" />
          ) : isError || !overallHealthy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red/10 px-2.5 py-1 text-xs font-semibold text-red">
              <XCircle className="h-3.5 w-3.5" />
              Degraded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal-50 px-2.5 py-1 text-xs font-semibold text-brand-teal-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Healthy
            </span>
          )}
        </div>

        {isError && (
          <p className="text-xs text-red">
            {formatApiError(error, { fallback: 'Could not reach the health endpoint.' })}
          </p>
        )}

        {health?.version && (
          <p className="text-xs text-ink-60">
            Version <span className="font-mono text-ink">{health.version}</span>
            {health.timestamp && (
              <>
                {' '}
                · Last checked{' '}
                {new Date(health.timestamp).toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </>
            )}
          </p>
        )}

        <div className="space-y-3">
          <ServiceRow label="Database" healthy={health?.services.db ?? false} loading={isLoading} />
          <ServiceRow label="AI (Azure Foundry)" healthy={health?.services.ai ?? false} loading={isLoading} />
          {!isLoading && health && !health.services.ai && (
            <p className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-ink-60">
              Azure AI Foundry is not configured. Add{' '}
              <code className="font-mono text-[11px] text-ink">AZURE_AI_FOUNDRY_API_KEY</code>,{' '}
              <code className="font-mono text-[11px] text-ink">AZURE_AI_FOUNDRY_ENDPOINT</code>, and{' '}
              <code className="font-mono text-[11px] text-ink">AZURE_AI_FOUNDRY_DEPLOYMENT_NAME</code>{' '}
              to your environment, then restart the dev server. Reports still generate draft content locally
              without these keys.
            </p>
          )}
        </div>

        <div className="border-t border-ink-20 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-60">
            Webhook endpoints
          </p>
          <div className="space-y-3">
            <WebhookUrlRow label="Email inbound" path="/api/webhooks/email" />
            <WebhookUrlRow label="Stripe billing" path="/api/webhooks/stripe" />
            <WebhookUrlRow label="Clerk auth sync" path="/api/webhooks/clerk" />
          </div>
        </div>
          </div>
        </div>
      </div>
    </section>
  );
}
