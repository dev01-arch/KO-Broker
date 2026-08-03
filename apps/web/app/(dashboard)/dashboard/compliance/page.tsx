import { redirect } from 'next/navigation';

/** ARCHIVED: legacy React compliance page. Live UI lives in LiveDemoPage iframe. */
export default function ArchivedCompliancePage() {
  redirect('/dashboard');
}
