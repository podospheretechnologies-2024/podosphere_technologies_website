'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/shared/lib/fetcher';

interface ImpersonateOwnerButtonProps {
  ownerUserId: string | null;
}

export function ImpersonateOwnerButton({ ownerUserId }: ImpersonateOwnerButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ownerUserId) {
    return <span className="text-xs text-gray-400">No owner</span>;
  }

  async function start() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ownerUserId }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="text-indigo-600 hover:text-indigo-900 disabled:opacity-60"
      >
        {loading ? 'Starting…' : 'Impersonate Owner'}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
