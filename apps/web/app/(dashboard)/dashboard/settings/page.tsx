import { redirect } from 'next/navigation';

/** ARCHIVED: legacy React settings shell. Settings open via LiveDemoPage `?tab=settings`. */
export default function ArchivedSettingsPage() {
  redirect('/dashboard?tab=settings');
}
