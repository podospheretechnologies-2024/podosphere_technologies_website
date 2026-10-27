'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import type { CurrentUserItem } from '../types';

interface InvitePreview {
  email: string;
  role: string;
  organizationName: string;
}

export function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('This invite link is missing its token. Ask your admin for a new one.');
      return;
    }
    apiFetch<InvitePreview>(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then(setPreview)
      .catch((err) =>
        setLoadError(err instanceof ApiError ? err.message : 'Could not load this invite.')
      );
  }, [token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const user = await apiFetch<CurrentUserItem>('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          name: form.get('name'),
          password: form.get('password'),
        }),
      });
      router.replace(user.isPlatformAdmin ? '/admin' : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
      setPending(false);
    }
  }

  if (loadError) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Invite unavailable</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">{loadError}</p>
        <Link
          href="/login"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium"
        >
          Go to login
        </Link>
      </>
    );
  }

  if (!preview) {
    return <p className="text-muted-foreground text-sm">Loading your invite…</p>;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Join {preview.organizationName}</h1>
      <p className="text-muted-foreground mt-1 mb-6 text-sm">
        You were invited as <span className="text-foreground font-medium">{preview.role}</span>. Set a
        password to finish creating your account.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <Input value={preview.email} type="email" disabled readOnly autoComplete="email" />
        </div>
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Your name
          </label>
          <Input id="name" name="name" type="text" autoComplete="name" required />
        </div>
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

        {error && <p className="text-danger text-sm">{error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account & log in'}
        </Button>
      </form>
    </>
  );
}
