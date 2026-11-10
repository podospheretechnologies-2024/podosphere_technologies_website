'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import { errorText, growthCall, useGrowth } from './growth-api';
import { CopyButton, Empty, ErrorLine, KeyValues, Panel, Pill, statusTone, textareaClass } from './growth-ui';

interface AdItem {
  id: string;
  campaignName: string;
  objective: string | null;
  budgetNote: string | null;
  adsetName: string;
  audience: string | null;
  adName: string;
  format: string | null;
  hook: string | null;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
  landingPage: string | null;
  product: string | null;
  placements: string | null;
  imageNote: string | null;
  imageUrl: string | null;
  rationale: string | null;
  status: string;
  feedback: string | null;
}

const FILTERS = ['all', 'pending', 'approved', 'live', 'rejected'] as const;

export function CampaignPlanTab({ onChange }: { onChange: () => void }) {
  const { data, error, mutate } = useGrowth<{ items: AdItem[]; canReview: boolean }>('/ad-plan');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const items = useMemo(() => data?.items ?? [], [data]);
  const list = items.filter((i) => filter === 'all' || i.status === filter);

  const grouped = useMemo(() => {
    const camps = new Map<string, Map<string, AdItem[]>>();
    for (const item of list) {
      const sets = camps.get(item.campaignName) ?? new Map<string, AdItem[]>();
      const ads = sets.get(item.adsetName) ?? [];
      ads.push(item);
      sets.set(item.adsetName, ads);
      camps.set(item.campaignName, sets);
    }
    return camps;
  }, [list]);

  const reload = () => {
    void mutate();
    onChange();
  };

  async function generate() {
    setBusy(true);
    setGenError(null);
    try {
      await growthCall('/ad-plan', 'POST', { generate: true, brief: brief || null });
      setBrief('');
      reload();
    } catch (e) {
      setGenError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Campaign plan and approvals"
      action={
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn('rounded-full px-3 py-0.5 text-xs', filter === f ? 'bg-primary text-primary-foreground' : 'border-border border')}
            >
              {f[0].toUpperCase() + f.slice(1)} ({f === 'all' ? items.length : items.filter((i) => i.status === f).length})
            </button>
          ))}
        </div>
      }
    >
      <p className="text-muted-foreground text-xs">
        Campaign → ad set → ad. The owner approves; the marketer builds it in Ads Manager with the copy buttons and marks it live. Nothing is created in
        Meta automatically.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Optional: what should the new ads focus on?" className="min-w-60 flex-1" />
        <Button variant="ai" disabled={busy} onClick={generate}>
          {busy ? 'Planning ads…' : 'Suggest new ads'}
        </Button>
      </div>
      <ErrorLine error={genError ?? error?.message ?? null} />
      {!list.length && <Empty>{items.length ? 'No ads with this status.' : 'New ads appear here for approval.'}</Empty>}
      <div className="flex flex-col gap-3">
        {[...grouped.entries()].map(([campaign, sets]) => {
          const first = [...sets.values()][0][0];
          return (
            <details key={campaign} open className="border-border bg-surface-muted/40 rounded-xl border">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 font-semibold">
                {campaign}
                <Pill>{[...sets.values()].reduce((n, a) => n + a.length, 0)} ads</Pill>
              </summary>
              <div className="flex flex-col gap-4 px-4 pb-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <CopyButton label="Copy campaign name" text={campaign} />
                  <span className="text-muted-foreground">
                    {first.objective}
                    {first.budgetNote ? ` · ${first.budgetNote}` : ''}
                  </span>
                </div>
                {[...sets.entries()].map(([adset, ads]) => (
                  <div key={adset} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-xs font-semibold uppercase">Ad set</span>
                      <span className="text-sm font-medium break-words">{adset}</span>
                      <CopyButton label="Copy" text={adset} />
                    </div>
                    {ads[0].audience && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Audience: {ads[0].audience}</span>
                        <CopyButton label="Copy audience" text={ads[0].audience} />
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {ads.map((ad) => (
                        <AdCard key={ad.id} ad={ad} canReview={data?.canReview ?? false} onDone={reload} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </Panel>
  );
}

function AdCard({ ad, canReview, onDone }: { ad: AdItem; canReview: boolean; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decide = async (status: 'approved' | 'rejected' | 'live') => {
    setBusy(true);
    setError(null);
    try {
      await growthCall(`/ad-plan/${ad.id}`, 'PATCH', { status, feedback: note || null });
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-border bg-surface flex min-w-0 flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold break-words">{ad.adName}</span>
        <Pill tone={statusTone(ad.status)}>{ad.status}</Pill>
      </div>
      <p className="text-muted-foreground text-xs">
        {ad.format}
        {ad.hook ? ` · Hook: ${ad.hook}` : ''}
      </p>
      <div className="border-border overflow-hidden rounded-lg border">
        <p className="px-3 py-2 text-sm whitespace-pre-wrap">{ad.primaryText}</p>
        <div className="bg-surface-muted text-muted-foreground px-3 py-3 text-center text-xs">
          {ad.imageNote || 'Creative'}
          {ad.imageUrl && (
            <a href={ad.imageUrl} target="_blank" rel="noopener noreferrer" className="text-primary block underline">
              Open image
            </a>
          )}
        </div>
        <div className="border-border flex items-center justify-between gap-2 border-t px-3 py-2">
          <div className="min-w-0">
            <b className="block truncate text-sm">{ad.headline}</b>
            <span className="text-muted-foreground block truncate text-xs">{ad.description}</span>
          </div>
          <span className="border-border rounded-md border px-2 py-1 text-xs font-semibold whitespace-nowrap">{ad.cta || 'Shop now'}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <CopyButton label="Ad name" text={ad.adName} />
        {ad.primaryText && <CopyButton label="Primary text" text={ad.primaryText} />}
        {ad.headline && <CopyButton label="Headline" text={ad.headline} />}
        {ad.landingPage && <CopyButton label="Landing page" text={ad.landingPage} />}
      </div>
      <KeyValues
        items={[
          ['Landing page', ad.landingPage],
          ['Product', ad.product],
          ['Placements', ad.placements],
          ['Why', ad.rationale],
          ['Owner note', ad.feedback],
        ]}
      />
      {ad.status === 'pending' && canReview && (
        <>
          <textarea className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note (changes you want)" />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => decide('approved')}>
              Approve
            </Button>
            <Button size="sm" variant="danger-ghost" disabled={busy} onClick={() => decide('rejected')}>
              Reject
            </Button>
          </div>
        </>
      )}
      {ad.status === 'approved' && (
        <>
          <p className="text-muted-foreground text-xs">Approved. Build it in Ads Manager, then mark it live.</p>
          <Button size="sm" disabled={busy} onClick={() => decide('live')}>
            Mark as live
          </Button>
        </>
      )}
      <ErrorLine error={error} />
    </div>
  );
}
