'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

type LoginResponse = {
  mustChangePassword: boolean;
  redirectTo: string;
};

export function ClientLoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<LoginResponse>('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          rememberMe: form.get('rememberMe') === 'on',
        }),
      });
      router.replace(result.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="client-email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <Input
          id="client-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label htmlFor="client-password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <Input
          id="client-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="rememberMe"
          className="border-border size-4 rounded"
        />
        Remember me for 30 days
      </label>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Please wait…' : 'Log in to portal'}
      </Button>
    </form>
  );
}
