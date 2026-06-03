'use client';

import { DashboardAuthGuard } from '@/components/auth/dashboard-auth-guard';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthGuard>
      <div className="flex min-h-screen bg-surface">
        <aside className="flex w-[220px] shrink-0 flex-col gap-0.5 border-r border-ink-20 bg-white px-3 py-5">
          <div className="px-3 pb-3 font-heading text-sm font-bold text-ink">KO Platform</div>
          <div className="mt-1 px-3 text-[10px] font-bold tracking-wider text-ink-60 uppercase">
            Main
          </div>
          <a
            href="/dashboard"
            className="rounded-md bg-brand-teal-50 px-3 py-2 text-sm font-medium text-brand-teal-700"
          >
            Overview
          </a>
          <a
            href="/dashboard/clients"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08 hover:text-ink"
          >
            Clients
          </a>
          <a
            href="/dashboard/cases"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08 hover:text-ink"
          >
            Cases
          </a>
          <div className="mt-3 px-3 text-[10px] font-bold tracking-wider text-ink-60 uppercase">
            Tools
          </div>
          <a
            href="/dashboard/messages"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08 hover:text-ink"
          >
            Messages
          </a>
          <a
            href="/dashboard/compliance"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08 hover:text-ink"
          >
            Compliance
          </a>
          <a
            href="/dashboard/ai-reports"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08 hover:text-ink"
          >
            AI Reports
          </a>
          <a
            href="/dashboard/calculators"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-60 hover:bg-ink-08 hover:text-ink"
          >
            Calculators
          </a>
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </DashboardAuthGuard>
  );
}
