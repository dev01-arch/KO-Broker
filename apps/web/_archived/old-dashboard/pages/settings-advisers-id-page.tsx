'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Advisers are managed inline inside Organization settings.
 * This route only redirects so legacy URLs never show a separate dashboard shell.
 */
export default function AdviserDetailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/settings?section=organization');
  }, [router]);

  return null;
}
