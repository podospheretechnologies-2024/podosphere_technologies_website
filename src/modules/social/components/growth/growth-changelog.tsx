'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { errorText, growthCall, useGrowth } from './growth-api';
import { Empty, ErrorLine, Panel } from './growth-ui';

interface Change {
  id: string;
  place: string;
  what: string;
  why: string | null;
  byName: string | null;
  createdAt: string;
}

export function ChangeLogTab() {
  const { data, error, mutate } = useGrowth<Change[]>('/changes');
  const [place, setPlace] = useState('');
  const [what, setWhat] = useState('');
  const [why, setWhy] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setMsg(null);
    try {
      await growthCall('/changes', 'POST', { place, what, why: why || null });
      setPlace('');
      setWhat('');
      setWhy('');
      setMsg('Logged.');
      void mutate();
    } catch (e) {
      setMsg(errorText(e));
    }
  }

  return (
    <Panel title="Change log">
      <p className="text-muted-foreground text-xs">
        Log every change made in Ads Manager or on the store, so the daily check can judge it the next day.
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Campaign / ad set / ad / page" aria-label="Where" />
        <Input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What changed" aria-label="What changed" />
        <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why" aria-label="Why" />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!place.trim() || !what.trim()} onClick={add}>
          Add to log
        </Button>
        {msg && <span className="text-muted-foreground text-sm">{msg}</span>}
      </div>
      <ErrorLine error={error?.message ?? null} />
      {!data?.length && <Empty>No changes logged yet.</Empty>}
      <div className="flex flex-col gap-2">
        {data?.map((c) => (
          <div key={c.id} className="border-border border-t pt-2 text-sm first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="break-words">{c.place}</strong>
              <span className="text-muted-foreground text-xs">
                {new Date(c.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                {c.byName ? ` · ${c.byName}` : ''}
              </span>
            </div>
            <p>{c.what}</p>
            {c.why && <p className="text-muted-foreground text-xs">Why: {c.why}</p>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
