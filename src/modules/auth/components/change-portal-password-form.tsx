'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

export function ChangePortalPasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<{ redirectTo: string }>('/api/portal/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.get('currentPassword') || undefined,
          password: form.get('password'),
          passwordConfirmation: form.get('passwordConfirmation'),
        }),
      });
      router.replace(result.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {requireCurrent ? (
        <div>
          <label htmlFor="currentPassword" className="mb-1.5 block text-sm font-medium">
            Current password
          </label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      ) : null}
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          New password
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
          Confirm new password
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
        {pending ? 'Saving…' : 'Save password'}
      </Button>
    </form>
  );
}
