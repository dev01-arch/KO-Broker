import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AdviserInvitePage } from '@/components/auth/adviser-invite-page';

export const metadata: Metadata = {
  title: 'Accept adviser invite',
};

/** Landing page for adviser invite emails: `/adviser/invite?token=...` */
export default function AdviserInviteRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdviserInvitePage />
    </Suspense>
  );
}
