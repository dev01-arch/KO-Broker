'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { DashboardAuthGuard } from '@/components/auth/dashboard-auth-guard';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Clients', href: '/dashboard/clients' },
  { label: 'Cases', href: '/dashboard/cases' },
];

const TOOL_ITEMS = [
  { label: 'Messages', href: '/dashboard/messages' },
  { label: 'Compliance', href: '/dashboard/compliance' },
  { label: 'AI Reports', href: '/dashboard/ai-reports' },
  { label: 'Calculators', href: '/dashboard/calculators' },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <DashboardAuthGuard>
      <div className="flex min-h-screen bg-surface">
        <aside className="flex w-[220px] shrink-0 flex-col gap-0.5 border-r border-ink-20 bg-white px-3 py-5">
          <div className="flex items-center justify-between gap-2 px-3 pb-3">
            <span className="font-heading text-sm font-bold text-ink">KO Platform</span>
            <UserButton afterSignOutUrl="/" />
          </div>

          <div className="mt-1 px-3 text-[10px] font-bold tracking-wider text-ink-60 uppercase">
            Main
          </div>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-brand-teal-50 text-brand-teal-700'
                  : 'text-ink-60 hover:bg-ink-08 hover:text-ink',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-3 px-3 text-[10px] font-bold tracking-wider text-ink-60 uppercase">
            Tools
          </div>
          {TOOL_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-brand-teal-50 text-brand-teal-700'
                  : 'text-ink-60 hover:bg-ink-08 hover:text-ink',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </DashboardAuthGuard>
  );
}
