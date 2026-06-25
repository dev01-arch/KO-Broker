import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KO Platform — The Smarter Broker Platform',
  description:
    'AI-powered suitability reports, built-in FCA compliance, messaging, and full CRM — designed by practitioners, priced for everyone.',
};

/** Marketing pages are public — no staging gate. Clerk handles app access. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-site min-h-screen bg-brand-bg font-body text-ink">
      {children}
    </div>
  );
}
