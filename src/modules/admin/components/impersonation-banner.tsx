'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { apiFetch } from '@/shared/lib/fetcher';

interface ImpersonationBannerProps {
  viewingAsName: string;
  viewingAsOrg: string;
}

export function ImpersonationBanner({ viewingAsName, viewingAsOrg }: ImpersonationBannerProps) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  async function stop() {
    setStopping(true);
    try {
      await apiFetch('/api/admin/impersonate', { method: 'DELETE' });
      router.push('/admin');
      router.refresh();
    } catch {
      setStopping(false);
    }
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] flex items-center justify-between gap-4 bg-red-600 px-4 py-2.5 text-sm text-white shadow-md"
    >
      <p className="flex min-w-0 items-center gap-2">
        <ShieldAlert className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          Impersonating <span className="font-semibold">{viewingAsName}</span>
          <span className="opacity-90"> ({viewingAsOrg})</span>
          <span className="hidden sm:inline"> — actions are audited. Billing changes are blocked.</span>
        </span>
      </p>
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        className="shrink-0 rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/25 disabled:opacity-60"
      >
        {stopping ? 'Stopping…' : 'Stop impersonating'}
      </button>
    </div>
  );
}
