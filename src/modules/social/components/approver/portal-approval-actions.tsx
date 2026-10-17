'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface PortalApprovalActionsProps {
  group: string;
}

export function PortalApprovalActions({ group }: PortalApprovalActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: 'approve' | 'reject') {
    let reason: string | undefined;
    if (action === 'reject') {
      const entered = window.prompt('What should we change?', 'Please revise this post');
      if (entered === null) return;
      reason = entered.trim() || 'Changes requested by client';
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/approver/posts/${group}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Could not update approval');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update approval');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-auto space-y-2 pt-4 border-t border-gray-100">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void decide('reject')}
        >
          Request Edit
        </Button>
        <Button type="button" className="flex-1" disabled={busy} onClick={() => void decide('approve')}>
          Approve
        </Button>
      </div>
    </div>
  );
}
