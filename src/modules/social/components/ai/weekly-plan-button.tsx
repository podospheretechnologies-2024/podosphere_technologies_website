'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useClientScope } from '../../hooks/use-client-scope';

export function WeeklyPlanButton() {
  const { selectedClientId } = useClientScope();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const response = await fetch('/api/social/ai/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as {
        error?: string;
        queued?: number;
        skipped?: boolean;
        reason?: string;
        created?: number;
      };
      if (!response.ok) throw new Error(payload.error || 'Could not generate weekly plan');
      if (payload.skipped) {
        setHint(payload.reason || 'Weekly plan skipped');
        return;
      }
      setHint(
        payload.queued === 1
          ? 'Weekly plan queued — drafts appear under Internal review when ready.'
          : `${payload.queued ?? 0} weekly plans queued — drafts appear under Internal review when ready.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate weekly plan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-border bg-surface space-y-2 rounded-2xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Weekly plan</h2>
        <p className="text-muted-foreground text-xs">
          {selectedClientId
            ? 'Generate draft posts for the selected client from brand kit and recent performance.'
            : 'Select a client (or run for all) to generate a week of draft posts for internal review.'}
        </p>
      </div>
      <Button type="button" onClick={() => void generate()} disabled={busy}>
        {busy ? 'Queueing…' : 'Generate weekly plan'}
      </Button>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && <p className="text-danger text-xs">{error}</p>}
    </section>
  );
}
