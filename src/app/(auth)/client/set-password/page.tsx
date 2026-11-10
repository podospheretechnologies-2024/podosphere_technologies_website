import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetPortalPasswordForm } from '@/modules/auth/components/set-portal-password-form';

export const metadata: Metadata = { title: 'Set portal password' };

export default function ClientSetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
      <SetPortalPasswordForm />
    </Suspense>
  );
}
