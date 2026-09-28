'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import type { CurrentUserItem } from '../types';

type Mode = 'login' | 'register';

const FIELDS: Record<Mode, { name: string; label: string; type: string; autoComplete: string }[]> = {
  login: [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
  ],
  register: [
    { name: 'organizationName', label: 'Company / workspace name', type: 'text', autoComplete: 'organization' },
    { name: 'name', label: 'Your name', type: 'text', autoComplete: 'name' },
    { name: 'email', label: 'Work email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
    { name: 'passwordConfirmation', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
  ],
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await apiFetch<CurrentUserItem>(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const next = searchParams.get('next');
      router.replace(next?.startsWith('/dashboard') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {FIELDS[mode].map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium">
            {field.label}
          </label>
          <Input id={field.name} name={field.name} type={field.type} autoComplete={field.autoComplete} required />
        </div>
      ))}

      {error && <p className="text-danger text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create workspace'}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {mode === 'login' ? (
          <>
            New to Podo Social?{' '}
            <Link href="/register" className="text-primary font-medium">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
