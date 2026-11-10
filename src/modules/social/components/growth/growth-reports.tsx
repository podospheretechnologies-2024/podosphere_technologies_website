'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { count, errorText, growthCall, money, times, useGrowth } from './growth-api';
import { CopyButton, Empty, ErrorLine, Panel, Pill } from './growth-ui';

interface Report {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  kpis: Record<string, number | null>;
  summary: string;
  insights: string[];
  done: string[];
  poa: { phase: string; dates: string; focus: string; actions: string[] }[];
  targets: string[];
  by: string;
  createdAt: string;
}

function reportText(r: Report, currency: string): string {
  const k = r.kpis;
  const lines = [
    `${r.title}: ${r.periodStart} to ${r.periodEnd}`,
    '',
    r.summary,
    '',
    `Sales ${money(k.sales, currency)} · Orders ${count(k.orders)} · Ad spend ${money(k.spend, currency)} · ROAS ${times(k.roas)} (target ${k.targetRoas}x) · Meta ROAS ${times(k.metaRoas)}`,
    '',
    'Insights:',
    ...r.insights.map((i) => `- ${i}`),
    '',
    'What was done:',
    ...(r.done.length ? r.done.map((d) => `- ${d}`) : ['- (no tasks closed in this period)']),
    '',
    'Plan for the next 30 days:',
    ...r.poa.flatMap((p) => [`${p.phase} (${p.dates}): ${p.focus}`, ...p.actions.map((a) => `  - ${a}`)]),
    '',
    'Targets:',
    ...r.targets.map((t) => `- ${t}`),
  ];
  return lines.join('\n');
}

export function ReportsTab({ currency, onChange, nextDue, due }: { currency: string; onChange: () => void; nextDue: string | null; due: boolean }) {
  const { data, error, mutate } = useGrowth<Report[]>('/reports');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setMsg('Writing the report…');
    try {
      await growthCall('/reports', 'POST');
      setMsg('Report saved.');
      void mutate();
      onChange();
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Performance reports"
      action={
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">{nextDue ? `Next due ${nextDue}` : 'No report yet'}</span>
          {due && <Pill tone="warn">Due</Pill>}
          <Button size="sm" variant="ai" disabled={busy} onClick={generate}>
            Generate report now
          </Button>
        </div>
      }
    >
      <p className="text-muted-foreground text-xs">Each report covers the last period (15 days by default): numbers, insights, what was done, and the plan for the next 30 days.</p>
      {msg && <p className="text-muted-foreground text-sm">{msg}</p>}
      <ErrorLine error={error?.message ?? null} />
      {!data?.length && <Empty>No reports yet.</Empty>}
      {data?.map((r, i) => (
        <details key={r.id} open={i === 0} className="border-border bg-surface-muted/40 rounded-xl border">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 font-semibold">
            {r.title}: {r.periodStart} to {r.periodEnd}
            {r.by === 'numbers' && <Pill>Numbers only</Pill>}
          </summary>
          <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
            <p>{r.summary}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ['Sales', money(r.kpis.sales, currency)],
                  ['Orders', count(r.kpis.orders)],
                  ['Ad spend', money(r.kpis.spend, currency)],
                  ['ROAS', times(r.kpis.roas)],
                  ['Meta ROAS', times(r.kpis.metaRoas)],
                  ['Target', `${r.kpis.targetRoas}x`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="bg-surface rounded-lg px-3 py-2 text-xs">
                  <b className="block text-base tabular-nums">{v}</b>
                  {k}
                </div>
              ))}
            </div>
            <Section title="Insights" items={r.insights} />
            <Section title="What was done" items={r.done.length ? r.done : ['No tasks closed in this period.']} />
            {r.poa.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase">Plan for the next 30 days</h3>
                {r.poa.map((p) => (
                  <div key={p.phase} className="border-primary mt-2 border-l-2 pl-3">
                    <strong>
                      {p.phase} {p.dates && <span className="text-muted-foreground font-normal">({p.dates})</span>}
                    </strong>
                    <p className="text-muted-foreground text-xs">{p.focus}</p>
                    <ul className="list-disc pl-5">
                      {p.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <Section title="Targets" items={r.targets} />
            <div className="flex gap-2">
              <CopyButton label="Copy report" text={reportText(r, currency)} />
              <Button
                size="sm"
                variant="danger-ghost"
                onClick={async () => {
                  if (!window.confirm('Delete this report?')) return;
                  await growthCall(`/reports/${r.id}`, 'DELETE').catch(() => undefined);
                  void mutate();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </details>
      ))}
    </Panel>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase">{title}</h3>
      <ul className="mt-1 list-disc pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
