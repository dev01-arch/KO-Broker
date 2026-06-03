import type { Metadata } from 'next';
import { LiveDemoPage } from '@/components/marketing/live-demo-page';

export const metadata: Metadata = {
  title: 'Live Demo',
  description: 'Interactive KO Platform prototype — pipeline, CRM, calculators, and AI reports.',
};

export default function DemoPage() {
  return <LiveDemoPage />;
}
