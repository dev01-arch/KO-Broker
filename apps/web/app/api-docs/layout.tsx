import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Reference — KO Broker',
  description: 'Interactive REST API documentation for the KO Broker platform.',
};

/**
 * /api-docs layout — fully public, no Clerk guard, no demo-gate.
 * Renders outside the dashboard chrome.
 */
export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
