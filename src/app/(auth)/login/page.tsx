import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginTabs } from '@/modules/auth/components/login-tabs';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
      <LoginTabs />
    </Suspense>
  );
}
