'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/cn';
import { errorText, growthCall, TASK_AREAS, useGrowth, type Insight, type Task, type TasksPayload } from './growth-api';
import { Empty, ErrorLine, Field, Panel, Pill, selectClass, textareaClass } from './growth-ui';

const PRIORITY_LABEL: Record<string, string> = { high: 'Do first', med: 'Today', low: 'When free' };
const PRIORITY_ORDER: Record<string, number> = { high: 0, med: 1, low: 2 };

function useTasks() {
  return useGrowth<TasksPayload>('/tasks');
}

export function TodayTab({ onChange }: { onChange: () => void }) {
  const tasks = useTasks();
  const insights = useGrowth<Insight[]>('/insights');
  const [area, setArea] = useState('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = tasks.data?.tasks ?? [];
  const open = all
    .filter((t) => t.status === 'todo')
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1) || b.createdAt.localeCompare(a.createdAt));
  const finished = all.filter((t) => t.status !== 'todo');
  const areas = ['all', ...new Set(open.map((t) => t.area))];
  const list = open.filter((t) => (area === 'all' || t.area === area) && (!mineOnly || t.assigneeId));
  const reload = () => {
    void tasks.mutate();
    onChange();
  };

  async function runInsights() {
    setBusy(true);
    setError(null);
    try {
      await growthCall('/insights', 'POST');
      await Promise.all([insights.mutate(), tasks.mutate()]);
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Tasks for the team"
        action={<span className="text-muted-foreground text-xs">{finished.length} of {all.length} done or in review</span>}
      >
        <div className="bg-surface-muted h-2 overflow-hidden rounded-full">
          <i className="bg-success block h-full" style={{ width: all.length ? `${(finished.length / all.length) * 100}%` : '0%' }} />
        </div>
        <div className="flex flex-wrap gap-1">
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={area === a}
              onClick={() => setArea(a)}
              className={cn('rounded-full px-3 py-0.5 text-xs', area === a ? 'bg-primary text-primary-foreground' : 'border-border border')}
            >
              {a === 'all' ? 'All' : a.toUpperCase()}
            </button>
          ))}
          <label className="text-muted-foreground ml-auto flex items-center gap-1 text-xs">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> Assigned only
          </label>
        </div>
        <ErrorLine error={tasks.error?.message ?? null} />
        {!all.length && <Empty>Tasks appear here from the daily findings, the content calendar, approved ads and the Idea box. Add one by hand below.</Empty>}
        {all.length > 0 && !list.length && <Empty>Nothing open here.</Empty>}
        <div className="flex flex-col gap-3">
          {list.map((t) => (
            <TaskRow key={t.id} task={t} people={tasks.data?.people ?? []} onDone={reload} />
          ))}
        </div>
        <NewTask people={tasks.data?.people ?? []} onCreated={reload} />
      </Panel>
      <Panel
        title="What the desk noticed"
        action={
          <Button size="sm" variant="ai" disabled={busy} onClick={runInsights}>
            {busy ? 'Reading the numbers…' : 'Run today’s check'}
          </Button>
        }
      >
        <ErrorLine error={error ?? insights.error?.message ?? null} />
        {!insights.data?.length && <Empty>The desk writes its findings here once a day (after 8 am). Press the button to run it now.</Empty>}
        <div className="flex flex-col gap-3">
          {insights.data?.map((i) => (
            <div key={i.id} className="grid grid-cols-[6px_minmax(0,1fr)] gap-3">
              <i
                className={cn(
                  'rounded',
                  i.severity === 'good' ? 'bg-success' : i.severity === 'bad' ? 'bg-danger' : i.severity === 'warn' ? 'bg-amber-500' : 'bg-border'
                )}
              />
              <div>
                <strong className="text-sm">{i.title}</strong>
                <p className="text-sm">{i.body}</p>
                <p className="text-muted-foreground text-xs">{i.date}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function TaskRow({ task, people, onDone }: { task: Task; people: { id: string; name: string }[]; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await growthCall(`/tasks/${task.id}`, 'PATCH', body);
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-border grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t pt-3 first:border-0 first:pt-0">
      <button
        type="button"
        disabled={busy}
        aria-label={`Mark done: ${task.title}`}
        title="Mark done (goes to review)"
        onClick={() => patch({ action: 'complete', note: note || null })}
        className="border-border hover:border-success hover:text-success grid size-7 place-items-center rounded-full border-2 text-transparent"
      >
        ✓
      </button>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">{task.title}</strong>
          <Pill tone={task.priority === 'high' ? 'bad' : task.priority === 'low' ? 'muted' : 'warn'}>{PRIORITY_LABEL[task.priority] ?? task.priority}</Pill>
          <Pill>{task.area}</Pill>
          {task.dueDate && <span className="text-muted-foreground text-xs">due {task.dueDate}</span>}
        </div>
        {task.detail && <p className="text-sm break-words whitespace-pre-wrap">{task.detail}</p>}
        {task.link && (
          <a href={task.link} target={task.link.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" className="text-primary text-xs underline">
            Open link
          </a>
        )}
        {task.reviewNote && <p className="text-danger text-xs">Sent back: {task.reviewNote}</p>}
        <div className="flex flex-wrap gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you did (optional)" className="h-8 min-w-40 flex-1" />
          <select
            className={cn(selectClass, 'h-8 text-xs')}
            value={task.assigneeId ?? ''}
            onChange={(e) => patch({ assigneeId: e.target.value || null })}
            aria-label="Assign to"
          >
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <ErrorLine error={error} />
      </div>
    </div>
  );
}

function NewTask({ people, onCreated }: { people: { id: string; name: string }[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [area, setArea] = useState<string>('ads');
  const [priority, setPriority] = useState('med');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open)
    return (
      <Button size="sm" variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        Add a task
      </Button>
    );

  async function save() {
    setError(null);
    try {
      await growthCall('/tasks', 'POST', {
        title,
        detail: detail || null,
        area,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDetail('');
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
      <textarea className={textareaClass} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details (optional)" />
      <div className="flex flex-wrap gap-2">
        <Field label="Area">
          <select className={selectClass} value={area} onChange={(e) => setArea(e.target.value)}>
            {TASK_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="high">Do first</option>
            <option value="med">Today</option>
            <option value="low">When free</option>
          </select>
        </Field>
        <Field label="Assign to">
          <select className={selectClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <ErrorLine error={error} />
      <div className="flex gap-2">
        <Button size="sm" disabled={title.trim().length < 2} onClick={save}>
          Save task
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ReviewTab({ onChange }: { onChange: () => void }) {
  const tasks = useTasks();
  const waiting = (tasks.data?.tasks ?? []).filter((t) => t.status === 'review');
  const done = (tasks.data?.tasks ?? []).filter((t) => t.status === 'done').slice(0, 40);
  const canReview = tasks.data?.canReview ?? false;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Waiting for review">
        <p className="text-muted-foreground text-xs">Tasks the team marked done. Approve them, or send one back with a note.</p>
        {!canReview && <p className="text-muted-foreground text-xs">You can see these; only reviewers (approve permission) can approve.</p>}
        {!waiting.length && <Empty>Nothing waiting.</Empty>}
        {waiting.map((t) => (
          <ReviewRow
            key={t.id}
            task={t}
            canReview={canReview}
            onDone={() => {
              void tasks.mutate();
              onChange();
            }}
          />
        ))}
      </Panel>
      <Panel title="Approved">
        {!done.length && <Empty>Nothing approved yet.</Empty>}
        {done.map((t) => (
          <div key={t.id} className="border-border border-t pt-2 text-sm first:border-0 first:pt-0">
            <span className="text-muted-foreground line-through">{t.title}</span>
            {t.doneNote && <p className="text-muted-foreground text-xs">Note: {t.doneNote}</p>}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function ReviewRow({ task, canReview, onDone }: { task: Task; canReview: boolean; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const act = async (action: 'approve' | 'send_back') => {
    setError(null);
    try {
      await growthCall(`/tasks/${task.id}`, 'PATCH', { action, note: note || null });
      onDone();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <div className="border-border flex flex-col gap-1.5 border-t pt-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">{task.title}</strong>
        <Pill>{task.area}</Pill>
        {task.assigneeName && <span className="text-muted-foreground text-xs">by {task.assigneeName}</span>}
      </div>
      {task.doneNote && <p className="text-sm">What was done: {task.doneNote}</p>}
      {canReview && (
        <div className="flex flex-wrap gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note if sending back" className="h-8 min-w-40 flex-1" />
          <Button size="sm" onClick={() => act('approve')}>
            Approve
          </Button>
          <Button size="sm" variant="danger-ghost" onClick={() => act('send_back')}>
            Send back
          </Button>
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}
