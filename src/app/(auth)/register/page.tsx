import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/modules/auth/components/auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        One workspace per brand or client. You can invite your team later.
      </p>
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </>
  );
}
