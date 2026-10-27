import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '@/modules/auth/components/auth-form';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        Sign up with your email to start using Podo Social.
      </p>
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </>
  );
}
