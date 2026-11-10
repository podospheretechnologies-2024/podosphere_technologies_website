'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

type RequestRow = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  status: string;
  reply: string | null;
  createdAt: string;
};

const TYPES = [
  { id: 'post', label: 'Post' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'change', label: 'Change' },
  { id: 'other', label: 'Other' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  declined: 'Declined',
};

export function PortalRequestsPanel({ initialRequests }: { initialRequests: RequestRow[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [type, setType] = useState<(typeof TYPES)[number]['id']>('post');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ request: RequestRow }>('/api/portal/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          detail: detail.trim() || undefined,
        }),
      });
      setRequests((rows) => [res.request, ...rows]);
      setTitle('');
      setDetail('');
      setType('post');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send request.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Requests</h2>
        <p className="mt-1 text-gray-500">Ask for a post, campaign, or change and track status here.</p>
      </div>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-medium text-gray-900">New request</p>
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-600">
            Type
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
            >
              {TYPES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Title
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Instagram reel for Diwali offer"
              maxLength={200}
            />
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-gray-600">
          Details (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            rows={3}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="What should we include?"
            maxLength={4000}
          />
        </label>
        <button
          type="button"
          disabled={saving || title.trim().length < 3}
          onClick={() => void submit()}
          className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Sending…' : 'Send request'}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          No requests yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{request.title}</p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {STATUS_LABELS[request.status] ?? request.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {TYPES.find((t) => t.id === request.type)?.label ?? request.type}
                {' · '}
                {new Date(request.createdAt).toLocaleDateString()}
              </p>
              {request.detail ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{request.detail}</p>
              ) : null}
              {request.reply ? (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="font-medium">Agency reply: </span>
                  {request.reply}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
