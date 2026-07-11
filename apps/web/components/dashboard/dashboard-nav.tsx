'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Building2, Lock } from 'lucide-react';
import { usePlanFeature } from '@/hooks/use-org';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Clients', href: '/dashboard/clients' },
  { label: 'Cases', href: '/dashboard/cases' },
];

const TOOL_ITEMS = [
  { label: 'Messages', href: '/dashboard/messages', feature: 'messages' as const },
  { label: 'Compliance', href: '/dashboard/compliance' },
  { label: 'AI Reports', href: '/dashboard/ai-reports', feature: 'ai_reports' as const },
  { label: 'Calculators', href: '/dashboard/calculators' },
  { label: 'Settings', href: '/dashboard/settings' },
];

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasMessages = usePlanFeature('messages');
  const hasAiReports = usePlanFeature('ai_reports');

  const isMainDashboard = pathname === '/dashboard';

  if (isMainDashboard) {
    return <>{children}</>;
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-ink-20 bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-ink-20 px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="rounded-md bg-brand-teal p-1">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-brand-teal">
              KO Platform
            </span>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <div className="px-4 pb-1 text-[10px] font-bold tracking-wider text-ink-60 uppercase">
            Main
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center rounded-md mx-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-brand-teal-50 text-brand-teal-700'
                  : 'text-ink-60 hover:bg-ink-08 hover:text-ink',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-4 px-4 pb-1 text-[10px] font-bold tracking-wider text-ink-60 uppercase">
            Tools
          </div>
          {TOOL_ITEMS.map((item) => {
            const locked =
              (item.feature === 'messages' && !hasMessages) ||
              (item.feature === 'ai_reports' && !hasAiReports);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center justify-between rounded-md mx-2 px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-brand-teal-50 text-brand-teal-700'
                    : 'text-ink-60 hover:bg-ink-08 hover:text-ink',
                  locked ? 'opacity-70' : '',
                ].join(' ')}
              >
                <span>{item.label}</span>
                {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-ink-60" aria-label="Upgrade required" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
