import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/modules/auth/components/auth-form';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">Log in to your Podo Social workspace.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}
