'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { count, errorText, growthCall, useGrowth } from './growth-api';
import { Empty, ErrorLine, Panel, Pill, statusTone } from './growth-ui';

interface TrackerPost {
  id: string;
  title: string;
  stage: string;
  late: boolean;
  publishDate: string;
  channel: string;
  provider: string;
  url: string | null;
  boost: { boost: boolean; budget: number | null; spend: number | null; note: string | null } | null;
  metrics: {
    type: string;
    reach: number | null;
    plays: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    engagementRate: number | null;
  } | null;
}

const STAGES: { id: string; label: string; next: string }[] = [
  { id: 'draft', label: 'Draft', next: 'Designer / editor finishes it and sends it for approval' },
  { id: 'internal_review', label: 'Internal review', next: 'Owner approves it' },
  { id: 'client_review', label: 'Client review', next: 'Client approves it' },
  { id: 'rejected', label: 'Rejected', next: 'Redo and send again' },
  { id: 'scheduled', label: 'Scheduled', next: 'Publishes on time' },
  { id: 'posted', label: 'Posted', next: 'Results come in from Instagram/Facebook' },
  { id: 'failed', label: 'Failed', next: 'SMM fixes and retries' },
];

function engagement(m: TrackerPost['metrics']): number | null {
  if (!m) return null;
  if (m.engagementRate != null) return m.engagementRate;
  const total = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
  return m.reach ? total / m.reach : null;
}

export function ContentTab() {
  const { data, error, mutate } = useGrowth<{ posts: TrackerPost[]; contentSheetUrl: string | null }>('/content');
  const [busy, setBusy] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [ideaNote, setIdeaNote] = useState<string | null>(null);
  const posts = data?.posts ?? [];
  const posted = posts.filter((p) => p.metrics?.reach).sort((a, b) => (engagement(b.metrics) ?? 0) - (engagement(a.metrics) ?? 0));

  const formats = new Map<string, { n: number; reach: number; er: number }>();
  for (const p of posted) {
    const key = p.metrics!.type || 'post';
    const f = formats.get(key) ?? { n: 0, reach: 0, er: 0 };
    f.n += 1;
    f.reach += p.metrics!.reach ?? 0;
    f.er += engagement(p.metrics) ?? 0;
    formats.set(key, f);
  }

  async function ideas() {
    setBusy(true);
    setIdeaError(null);
    try {
      const res = await growthCall<{ ideas: unknown[] }>('/content/ideas', 'POST');
      setIdeaNote(`${res.ideas.length} ideas saved in the Idea box. Open it to turn them into tasks.`);
    } catch (e) {
      setIdeaError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Posting tracker"
        action={
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard/social/calendar" className="text-primary underline">
              Open Calendar
            </Link>
            {data?.contentSheetUrl && (
              <a href={data.contentSheetUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Content calendar sheet
              </a>
            )}
          </div>
        }
      >
        <p className="text-muted-foreground text-xs">
          Every post for this client from the Calendar (last 45 days, next 60). Each stage makes a task for the right person automatically, and closes it when the
          post moves on.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {STAGES.map((s) => (
            <div key={s.id} className="bg-surface-muted rounded-lg px-3 py-2 text-xs">
              <b className="block text-lg tabular-nums">{posts.filter((p) => p.stage === s.id).length}</b>
              {s.label}
            </div>
          ))}
        </div>
        <ErrorLine error={error?.message ?? null} />
        {!posts.length && <Empty>No posts for this client in the Calendar yet.</Empty>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {posts
            .filter((p) => p.stage !== 'posted' || p.boost)
            .slice(0, 60)
            .map((p) => (
              <PostCard key={p.id} post={p} onSaved={() => void mutate()} />
            ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Results of posted content">
          <p className="text-muted-foreground text-xs">Pulled automatically from Instagram/Facebook. Engagement = (likes + comments + shares + saves) ÷ reach.</p>
          {!posted.length && <Empty>No results yet.</Empty>}
          {posted.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead className="text-muted-foreground">
                  <tr className="border-border border-b">
                    {['Post', 'Type', 'Reach', 'Plays', 'Likes', 'Comments', 'Shares', 'Saves', 'Engagement', 'Boost'].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posted.slice(0, 30).map((p) => (
                    <tr key={p.id} className="border-border border-b">
                      <td className="max-w-56 px-2 py-1.5 break-words">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {p.title}
                          </a>
                        ) : (
                          p.title
                        )}
                      </td>
                      <td className="px-2 py-1.5">{p.metrics!.type}</td>
                      <td className="px-2 py-1.5">{count(p.metrics!.reach)}</td>
                      <td className="px-2 py-1.5">{count(p.metrics!.plays)}</td>
                      <td className="px-2 py-1.5">{count(p.metrics!.likes)}</td>
                      <td className="px-2 py-1.5">{count(p.metrics!.comments)}</td>
                      <td className="px-2 py-1.5">{count(p.metrics!.shares)}</td>
                      <td className="px-2 py-1.5">{count(p.metrics!.saves)}</td>
                      <td className="px-2 py-1.5 font-semibold">{((engagement(p.metrics) ?? 0) * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1.5">{p.boost?.spend != null ? count(p.boost.spend) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {formats.size > 0 && (
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr className="border-border border-b">
                  {['Format', 'Posts', 'Avg reach', 'Avg engagement'].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...formats.entries()].map(([k, f]) => (
                  <tr key={k} className="border-border border-b">
                    <td className="px-2 py-1.5">{k}</td>
                    <td className="px-2 py-1.5">{f.n}</td>
                    <td className="px-2 py-1.5">{count(f.reach / f.n)}</td>
                    <td className="px-2 py-1.5">{((f.er / f.n) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel
          title="New content ideas"
          action={
            <Button size="sm" variant="ai" disabled={busy} onClick={ideas}>
              {busy ? 'Thinking…' : 'Ideas from results'}
            </Button>
          }
        >
          <p className="text-muted-foreground text-xs">Ideas based on what has worked. They are saved in the Idea box, where one click makes them tasks.</p>
          <ErrorLine error={ideaError} />
          {ideaNote && <p className="text-success text-sm">{ideaNote}</p>}
        </Panel>
      </div>
    </div>
  );
}

function PostCard({ post, onSaved }: { post: TrackerPost; onSaved: () => void }) {
  const stage = STAGES.find((s) => s.id === post.stage);
  const [boost, setBoost] = useState(post.boost?.boost ?? false);
  const [budget, setBudget] = useState(post.boost?.budget?.toString() ?? '');
  const [spend, setSpend] = useState(post.boost?.spend?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const late = post.late;

  async function save() {
    setError(null);
    try {
      await growthCall(`/content/${post.id}/boost`, 'PUT', {
        boost,
        budget: budget === '' ? null : Number(budget),
        spend: spend === '' ? null : Number(spend),
      });
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold break-words">{post.title}</span>
        <div className="flex gap-1">
          {late && <Pill tone="bad">Late</Pill>}
          <Pill tone={statusTone(post.stage)}>{stage?.label ?? post.stage}</Pill>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        {post.channel} · {new Date(post.publishDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
      <p className="text-xs">Next: {stage?.next}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={boost} onChange={(e) => setBoost(e.target.checked)} /> Boost this post
        </label>
        {boost && (
          <>
            <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget" className="h-7 w-24" />
            {post.stage === 'posted' && (
              <Input type="number" min={0} value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="Spent" className="h-7 w-24" />
            )}
          </>
        )}
        <Button size="sm" variant="secondary" className="h-7" onClick={save}>
          {saved ? 'Saved' : 'Save'}
        </Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}
