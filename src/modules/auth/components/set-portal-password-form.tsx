'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

export function SetPortalPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Link incomplete</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          This set-password link is missing its token. Ask your agency for a new one.
        </p>
        <Link href="/login" className="text-primary text-sm font-medium">
          Go to login
        </Link>
      </>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<{ redirectTo: string }>('/api/portal/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: form.get('password'),
          passwordConfirmation: form.get('passwordConfirmation'),
        }),
      });
      router.replace(result.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set password.');
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose your password</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        Pick a password you will use to open your client portal.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label htmlFor="passwordConfirmation" className="mb-1.5 block text-sm font-medium">
            Confirm password
          </label>
          <Input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Saving…' : 'Save and open portal'}
        </Button>
      </form>
    </>
  );
}
