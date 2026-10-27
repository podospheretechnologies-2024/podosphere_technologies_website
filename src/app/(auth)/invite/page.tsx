import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AcceptInviteForm } from '@/modules/auth/components/accept-invite-form';

export const metadata: Metadata = { title: 'Accept invite' };

export default function InvitePage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading your invite…</p>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
