'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border-border bg-surface flex min-w-0 flex-col gap-3 rounded-xl border p-4', className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const PILL_TONES: Record<string, string> = {
  good: 'bg-success/15 text-success',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  bad: 'bg-danger/15 text-danger',
  info: 'bg-primary/10 text-primary',
  muted: 'bg-surface-muted text-muted-foreground',
};

export function Pill({ tone = 'muted', children }: { tone?: keyof typeof PILL_TONES | string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', PILL_TONES[tone] ?? PILL_TONES.muted)}>
      {children}
    </span>
  );
}

export function statusTone(status: string): string {
  if (['approved', 'live', 'done', 'published', 'posted', 'ACTIVE', 'good', 'scheduled'].includes(status)) return 'good';
  if (['pending', 'review', 'draft', 'changes', 'internal_review', 'client_review', 'warn', 'med'].includes(status)) return 'warn';
  if (['rejected', 'failed', 'bad', 'high'].includes(status)) return 'bad';
  return 'muted';
}

export function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="border-border hover:bg-surface-muted rounded-md border px-2 py-0.5 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          // clipboard blocked: the text is visible to select by hand
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-danger text-sm">{error}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-muted-foreground flex flex-col gap-1 text-xs">
      {label}
      {children}
    </label>
  );
}

export const textareaClass =
  'border-border bg-surface text-foreground placeholder:text-muted-foreground focus:border-primary min-h-20 w-full rounded-lg border px-3 py-2 text-sm outline-none';
export const selectClass =
  'border-border bg-surface text-foreground focus:border-primary h-10 rounded-lg border px-3 text-sm outline-none';

/** Small key/value list that skips empty values and turns https links into anchors. */
export function KeyValues({ items }: { items: [string, string | null | undefined][] }) {
  const rows = items.filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words">
            {/^https:\/\//.test(v!) ? (
              <a href={v!} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {v}
              </a>
            ) : (
              v
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Sales bars + spend line (or two lines), plain SVG so it works in both themes without a chart library. */
export function DualChart({
  labels,
  bars,
  line,
  barLabel,
  lineLabel,
  lineOnly = false,
}: {
  labels: string[];
  bars: (number | null)[];
  line: (number | null)[];
  barLabel: string;
  lineLabel: string;
  lineOnly?: boolean;
}) {
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 8, t: 10, b: 24 };
  const values = [...bars, ...line].filter((v): v is number => v != null);
  const max = Math.max(1, ...values);
  const n = Math.max(1, labels.length);
  const step = (W - pad.l - pad.r) / n;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const linePath = line
    .map((v, i) => (v == null ? null : `${pad.l + step * i + step / 2},${y(v)}`))
    .filter(Boolean)
    .join(' ');
  const barPath = bars
    .map((v, i) => (v == null ? null : `${pad.l + step * i + step / 2},${y(v)}`))
    .filter(Boolean)
    .join(' ');
  const every = Math.ceil(n / 8);
  if (!values.length) return <Empty>No data for these dates yet.</Empty>;
  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-label={`${barLabel} and ${lineLabel} by day`}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} className="stroke-border" strokeWidth={1} />
            <text x={pad.l - 6} y={y(max * f) + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {Math.round(max * f).toLocaleString('en-IN')}
            </text>
          </g>
        ))}
        {!lineOnly &&
          bars.map((v, i) =>
            v == null ? null : (
              <rect
                key={i}
                x={pad.l + step * i + step * 0.15}
                width={step * 0.7}
                y={y(v)}
                height={Math.max(0, H - pad.b - y(v))}
                rx={2}
                className="fill-primary/70"
              >
                <title>{`${labels[i]}: ${barLabel} ${v.toLocaleString('en-IN')}`}</title>
              </rect>
            )
          )}
        {lineOnly && barPath && <polyline points={barPath} fill="none" className="stroke-primary" strokeWidth={2} />}
        {linePath && <polyline points={linePath} fill="none" className="stroke-danger" strokeWidth={2} />}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={l} x={pad.l + step * i + step / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {l.slice(5)}
            </text>
          ) : null
        )}
      </svg>
      <div className="text-muted-foreground flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <i className="bg-primary/70 inline-block h-2 w-3 rounded-sm" /> {barLabel}
        </span>
        <span className="flex items-center gap-1">
          <i className="bg-danger inline-block h-0.5 w-3" /> {lineLabel}
        </span>
      </div>
    </div>
  );
}
