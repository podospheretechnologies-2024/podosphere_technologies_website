'use client';

import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

export function PortalRequestPostForm() {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSent(false);
    try {
      await apiFetch('/api/portal/content/request-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          ...(brief.trim() ? { brief: brief.trim() } : {}),
          ...(dueDate ? { dueDate } : {}),
        }),
      });
      setTitle('');
      setBrief('');
      setDueDate('');
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send post request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-10 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-foreground">Request a post</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell the agency what you need. It shows up on their Requests list.
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {sent ? <p className="mt-3 text-sm text-green-700">Request sent.</p> : null}
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        <label className="block text-xs font-medium text-muted-foreground sm:col-span-2">
          Title
          <input
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Instagram reel for Diwali offer"
            maxLength={200}
            required
            minLength={3}
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground sm:col-span-2">
          Brief (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            rows={3}
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder="What should we include, tone, offer, CTA…"
            maxLength={4000}
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Due date (optional)
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <div className="flex items-end sm:col-span-1">
          <button
            type="submit"
            disabled={saving || title.trim().length < 3}
            className="min-h-11 w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>
    </section>
  );
}
