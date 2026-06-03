'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Calculator as CalculatorIcon, type LucideIcon } from 'lucide-react';
import MortgageCalculators from '@/components/marketing/demo-calculator/MortgageCalculators';

type DemoTab = 'overview' | 'clients' | 'cases' | 'messages' | 'ai' | 'calculator';

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
];

function isCalculatorTab(tab: DemoTab): tab is 'calculator' {
  return tab === 'calculator';
}

export function LiveDemoPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>('overview');
  const [frameHeight, setFrameHeight] = useState<number>(1200);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const showCalculator = isCalculatorTab(activeTab);

  useEffect(() => {
    if (showCalculator) return;
    setIframeLoaded(false);
  }, [activeTab, showCalculator]);

  useEffect(() => {
    if (showCalculator || !iframeLoaded) return;

    const syncHeight = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const doc = iframe.contentWindow?.document;
        if (!doc) return;
        const bodyHeight = doc.body?.scrollHeight ?? 0;
        const htmlHeight = doc.documentElement?.scrollHeight ?? 0;
        const next = Math.max(bodyHeight, htmlHeight, 1000);
        if (next > 0) setFrameHeight(next);
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
  }, [activeTab, iframeLoaded, showCalculator]);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-brand-bg lg:flex-row">
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
                  ) : (
                    <item.icon
                      className="h-6 w-6 shrink-0"
                      style={{ color: isActive ? '#00B8D9' : '#535e5b' }}
                      aria-hidden
                    />
                  )}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        {showCalculator ? (
          <div className="relative mx-auto w-full max-w-7xl px-6 pt-6 pb-10">
            <MortgageCalculators />
          </div>
        ) : (
          <div className="relative mx-auto w-full max-w-7xl px-6 pt-6 pb-10">
            {!iframeLoaded && (
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
            <iframe
              key={activeTab}
              ref={iframeRef}
              src={`/live-demo-prototype-v2a.html?embedded=1&tab=${activeTab}`}
              title="KO Platform Live Demo Prototype"
              className={`block w-full border-0 transition-opacity duration-200 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ height: `${frameHeight}px` }}
              scrolling="no"
              loading="eager"
              onLoad={() => setIframeLoaded(true)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
