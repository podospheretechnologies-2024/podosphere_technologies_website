'use client';

import { useState, type FormEvent } from 'react';

/** Minimal public form that records a data-deletion request via POST /api/data-deletion. */
export function DataDeletionRequestForm() {
  const [email, setEmail] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ code: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, workspaceName: workspaceName || undefined }),
      });
      const data = (await res.json().catch(() => null)) as
        | { confirmation_code?: string; url?: string; error?: string }
        | null;
      if (!res.ok || !data?.confirmation_code || !data.url) {
        throw new Error(data?.error ?? 'Could not submit the request');
      }
      setResult({ code: data.confirmation_code, url: data.url });
      setEmail('');
      setWorkspaceName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the request');
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <p className="mt-4 text-sm">
        Request recorded. Confirmation code: <strong>{result.code}</strong>.{' '}
        <a href={result.url} className="text-primary underline">
          Check status
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-3">
      <label className="block text-sm">
        <span className="text-foreground font-medium">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-border bg-background mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          autoComplete="email"
        />
      </label>
      <label className="block text-sm">
        <span className="text-foreground font-medium">Workspace name (optional)</span>
        <input
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          className="border-border bg-background mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Submitting…' : 'Request data deletion'}
      </button>
    </form>
  );
}
