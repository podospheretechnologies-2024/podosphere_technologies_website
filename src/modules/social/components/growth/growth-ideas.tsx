'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { errorText, growthCall, useGrowth } from './growth-api';
import { CopyButton, Empty, ErrorLine, KeyValues, Panel, Pill, textareaClass } from './growth-ui';

interface VideoIdea {
  id: string;
  title: string;
  length: string | null;
  hook: string | null;
  tool: string | null;
  product: string | null;
  landingPage: string | null;
  prompts: { label: string; text: string }[];
}

export function IdeasTab() {
  const { data, error, mutate } = useGrowth<{ videos: VideoIdea[]; competitors: { id: string; name: string; platform: string; externalId: string }[] }>(
    '/videos'
  );
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setGenError(null);
    try {
      await growthCall('/videos', 'POST');
      void mutate();
    } catch (e) {
      setGenError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="AI video ideas"
        action={
          <Button size="sm" variant="ai" disabled={busy} onClick={generate}>
            {busy ? 'Writing scripts…' : 'New video ideas'}
          </Button>
        }
      >
        <p className="text-muted-foreground text-xs">
          Each video has ready-to-paste prompts in order. Copy a prompt into Gemini or Google Flow, and attach the real product photo where the step says so.
        </p>
        <ErrorLine error={genError ?? error?.message ?? null} />
        {!data?.videos.length && <Empty>Video scripts and prompts appear here.</Empty>}
        {data?.videos.map((v, i) => (
          <details key={v.id} open={i === 0} className="border-border bg-surface-muted/40 rounded-xl border">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 font-semibold">
              {v.title}
              {v.length && <Pill>{v.length}</Pill>}
            </summary>
            <div className="flex flex-col gap-3 px-4 pb-4">
              {v.hook && <p className="text-sm">Hook: “{v.hook}”</p>}
              <KeyValues
                items={[
                  ['Tool', v.tool],
                  ['Product', v.product],
                  ['Landing page', v.landingPage],
                ]}
              />
              {v.prompts.length > 1 && <CopyButton label="Copy all prompts" text={v.prompts.map((p, n) => `${n + 1}. ${p.label}\n${p.text}`).join('\n\n')} />}
              {v.prompts.map((p, n) => (
                <div key={n} className="bg-surface rounded-lg p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">
                      {n + 1}. {p.label}
                    </span>
                    <CopyButton label="Copy" text={p.text} />
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{p.text}</p>
                </div>
              ))}
              <Button
                size="sm"
                variant="danger-ghost"
                className="self-start"
                onClick={async () => {
                  await growthCall(`/videos/${v.id}`, 'DELETE').catch(() => undefined);
                  void mutate();
                }}
              >
                Remove
              </Button>
            </div>
          </details>
        ))}
      </Panel>
      <Panel title="Competitor references">
        <p className="text-muted-foreground text-xs">
          Competitors tracked for this client (add more on the{' '}
          <Link href="/dashboard/social/analytics" className="text-primary underline">
            Analytics
          </Link>{' '}
          page). Study their ads in the Meta Ad Library; do not copy them.
        </p>
        {!data?.competitors.length && <Empty>No competitors tracked yet.</Empty>}
        {data?.competitors.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
            <strong>{c.name}</strong>
            <Pill>{c.platform}</Pill>
            <a
              href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=IN&q=${encodeURIComponent(c.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs underline"
            >
              Ad Library
            </a>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ---------------- Idea box ----------------

interface BriefOutput {
  title?: string;
  summary?: string;
  ideas?: string[];
  creative?: string;
  script?: string;
  copy?: { label: string; text: string }[];
  tasks?: { title: string; detail?: string; area?: string }[];
  contentIdeas?: { title: string; type: string; description: string; products: string; why: string }[];
}
interface Brief {
  id: string;
  area: string;
  ask: string;
  output: BriefOutput | null;
  tasksAdded: boolean;
  createdAt: string;
  error?: string | null;
}

const AREAS = ['Ads', 'Performance marketing', 'Social content', 'SEO / blog', 'Website', 'Anything'];

function briefText(o: BriefOutput): string {
  const lines = [o.title ?? '', o.summary ?? ''];
  if (o.ideas?.length) lines.push('Ideas:', ...o.ideas.map((i) => `- ${i}`));
  if (o.creative) lines.push('Creative direction:', o.creative);
  if (o.script) lines.push('Script:', o.script);
  for (const c of o.copy ?? []) lines.push(`${c.label}:`, c.text);
  if (o.tasks?.length) lines.push('Tasks:', ...o.tasks.map((t) => `- ${t.title}${t.detail ? `: ${t.detail}` : ''}`));
  return lines.filter(Boolean).join('\n');
}

export function IdeaBoxTab({ onChange }: { onChange: () => void }) {
  const { data, error, mutate } = useGrowth<Brief[]>('/briefs');
  const [area, setArea] = useState(AREAS[0]);
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setNote(null);
    try {
      const res = await growthCall<Brief>('/briefs', 'POST', { area, ask });
      setNote(res.output ? 'Brief ready below.' : `Saved, but the AI was not available: ${res.error ?? 'try again'}`);
      if (res.output) setAsk('');
      void mutate();
    } catch (e) {
      setNote(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Idea box">
        <p className="text-muted-foreground text-xs">
          Type any idea, rough thought or question. The desk turns it into a worked brief: sharper ideas, creative direction, a script, ready copy and tasks.
        </p>
        <div className="flex flex-wrap gap-1">
          {AREAS.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={area === a}
              onClick={() => setArea(a)}
              className={cn('rounded-full px-3 py-0.5 text-xs', area === a ? 'bg-primary text-primary-foreground' : 'border-border border')}
            >
              {a}
            </button>
          ))}
        </div>
        <textarea
          className={`${textareaClass} min-h-24`}
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          placeholder="Example: a reel where a customer checks if her shampoo is fake. Funny, for wedding season."
        />
        <div className="flex items-center gap-3">
          <Button variant="ai" disabled={busy || ask.trim().length < 3} onClick={go}>
            {busy ? 'Working on it…' : 'Get the brief'}
          </Button>
          {note && <span className="text-muted-foreground text-sm">{note}</span>}
        </div>
      </Panel>
      <ErrorLine error={error?.message ?? null} />
      {data?.map((b, i) => (
        <BriefCard
          key={b.id}
          brief={b}
          open={i === 0}
          onDone={() => {
            void mutate();
            onChange();
          }}
        />
      ))}
    </div>
  );
}

function BriefCard({ brief, open, onDone }: { brief: Brief; open: boolean; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const o = brief.output;
  return (
    <details open={open} className="border-border bg-surface rounded-xl border">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 font-semibold">
        {o?.title || brief.ask.slice(0, 80)}
        <Pill>{brief.area}</Pill>
        <span className="text-muted-foreground text-xs font-normal">{brief.createdAt.slice(0, 10)}</span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
        <p className="text-muted-foreground text-xs">Asked: {brief.ask}</p>
        {!o && <Empty>No brief: the AI was not available when this was asked.</Empty>}
        {o?.summary && <p>{o.summary}</p>}
        {o?.ideas && o.ideas.length > 0 && (
          <ul className="list-disc pl-5">
            {o.ideas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        )}
        {o?.contentIdeas?.map((c) => (
          <div key={c.title} className="bg-surface-muted rounded-lg p-3">
            <strong>{c.title}</strong> <Pill>{c.type}</Pill>
            <p>{c.description}</p>
            <p className="text-muted-foreground text-xs">Products: {c.products} · Why: {c.why}</p>
          </div>
        ))}
        {o?.creative && (
          <div>
            <span className="text-muted-foreground text-xs font-semibold uppercase">Creative direction</span>
            <p className="whitespace-pre-wrap">{o.creative}</p>
          </div>
        )}
        {o?.script && (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase">Script</span>
              <CopyButton label="Copy" text={o.script} />
            </div>
            <p className="whitespace-pre-wrap">{o.script}</p>
          </div>
        )}
        {o?.copy?.map((c) => (
          <div key={c.label}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase">{c.label}</span>
              <CopyButton label="Copy" text={c.text} />
            </div>
            <p className="whitespace-pre-wrap">{c.text}</p>
          </div>
        ))}
        {o?.tasks && o.tasks.length > 0 && (
          <div>
            <span className="text-muted-foreground text-xs font-semibold uppercase">Tasks</span>
            <ul className="list-disc pl-5">
              {o.tasks.map((t) => (
                <li key={t.title}>
                  {t.title} {t.area && <Pill>{t.area}</Pill>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {o && <CopyButton label="Copy whole brief" text={briefText(o)} />}
          {o?.tasks && o.tasks.length > 0 && (
            <Button
              size="sm"
              disabled={brief.tasksAdded}
              onClick={async () => {
                setError(null);
                try {
                  await growthCall(`/briefs/${brief.id}/tasks`, 'POST');
                  onDone();
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              {brief.tasksAdded ? 'Tasks added' : 'Add these as tasks'}
            </Button>
          )}
          <Button
            size="sm"
            variant="danger-ghost"
            onClick={async () => {
              await growthCall(`/briefs/${brief.id}`, 'DELETE').catch(() => undefined);
              onDone();
            }}
          >
            Remove
          </Button>
        </div>
        <ErrorLine error={error} />
      </div>
    </details>
  );
}
