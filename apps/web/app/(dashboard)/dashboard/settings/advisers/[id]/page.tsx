import { redirect } from 'next/navigation';

/** ARCHIVED: legacy adviser detail route. Managed in LiveDemoPage settings. */
export default function ArchivedAdviserDetailPage() {
  redirect('/dashboard?tab=settings');
}
