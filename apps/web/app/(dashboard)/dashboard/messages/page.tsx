import { redirect } from 'next/navigation';

/** ARCHIVED: legacy React messages hub. Live UI lives in LiveDemoPage iframe. */
export default function ArchivedMessagesPage() {
  redirect('/dashboard');
}
