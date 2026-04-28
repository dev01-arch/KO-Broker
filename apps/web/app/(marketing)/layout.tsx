import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KO Platform — The Smarter Broker Platform',
  description:
    'AI-powered suitability reports, built-in FCA compliance, messaging, and full CRM — designed by practitioners, priced for everyone.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
