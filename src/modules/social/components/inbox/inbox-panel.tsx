'use client';

import { useEffect, useState } from 'react';
import { useClientScopeKey } from '../../hooks/use-client-scope';

interface Member {
  id: string;
  name: string;
  email: string;
}

interface Thread {
  id: string;
  platform: string;
  contactName: string | null;
  lastPreview: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  slaDueAt: string | null;
  overdue: boolean;
}

interface Message {
  id: string;
  direction: string;
  body: string;
}

export function InboxPanel() {
  const scopeKey = useClientScopeKey();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  function loadThreads(filter = assigneeFilter) {
    const query =
      filter === 'all' ? '' : filter === 'unassigned' ? '?assigneeId=unassigned' : `?assigneeId=${encodeURIComponent(filter)}`;
    return fetch(`/api/social/inbox${query}`)
      .then(async (response) => {
        const payload = (await response.json()) as Thread[] | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : 'Could not load inbox');
        setThreads(payload as Thread[]);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    setMessages([]);
    setSelectedId(null);
    setError(null);
    void loadThreads(assigneeFilter);
  }, [scopeKey, assigneeFilter]);

  useEffect(() => {
    void fetch('/api/social/inbox/members')
      .then(async (response) => {
        const payload = (await response.json()) as Member[] | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : 'Could not load members');
        setMembers(payload as Member[]);
      })
      .catch((err: Error) => setError(err.message));
  }, [scopeKey]);

  async function assignThread(threadId: string, assigneeId: string) {
    const body = { assigneeId: assigneeId === '' ? null : assigneeId };
    const response = await fetch(`/api/social/inbox/${threadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as Thread | { error?: string };
    if (!response.ok) {
      setError('error' in payload ? (payload.error ?? 'Could not assign') : 'Could not assign');
      return;
    }
    const updated = payload as Thread;
    setThreads((prev) => prev.map((thread) => (thread.id === threadId ? { ...thread, ...updated } : thread)));
  }

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-muted-foreground text-xs" htmlFor="inbox-assignee-filter">
          Assignee
        </label>
        <select
          id="inbox-assignee-filter"
          className="border-border bg-background rounded-lg border px-2 py-1 text-sm"
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
        >
          <option value="all">All</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <ul className="border-border space-y-1 rounded-2xl border p-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                className={`hover:bg-surface-muted w-full rounded-xl px-3 py-2 text-left ${
                  selectedId === thread.id ? 'bg-surface-muted' : ''
                }`}
                onClick={() => {
                  setSelectedId(thread.id);
                  void fetch(`/api/social/inbox/${thread.id}`)
                    .then((response) => response.json())
                    .then((payload: { messages: Message[] }) => setMessages(payload.messages ?? []));
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{thread.contactName || thread.platform}</p>
                  {thread.overdue && (
                    <span className="border-danger/40 bg-danger/10 text-danger shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground truncate text-xs">{thread.lastPreview}</p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  {thread.assigneeName ? `Assigned: ${thread.assigneeName}` : 'Unassigned'}
                </p>
              </button>
            </li>
          ))}
          {threads.length === 0 && <li className="text-muted-foreground p-3 text-sm">No Page or Instagram messages yet.</li>}
        </ul>
        <div className="border-border min-h-80 space-y-3 rounded-2xl border p-4">
          {error && <p className="text-danger text-sm">{error}</p>}
          {selected && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              <label className="text-muted-foreground text-xs" htmlFor="thread-assign">
                Assign to
              </label>
              <select
                id="thread-assign"
                className="border-border bg-background rounded-lg border px-2 py-1 text-sm"
                value={selected.assigneeId ?? ''}
                onChange={(event) => {
                  void assignThread(selected.id, event.target.value);
                }}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              {selected.slaDueAt && (
                <span className="text-muted-foreground text-xs">
                  SLA {new Date(selected.slaDueAt).toLocaleString()}
                  {selected.overdue ? ' · overdue' : ''}
                </span>
              )}
            </div>
          )}
          {messages.map((message) => (
            <p key={message.id} className="text-sm">
              {message.direction === 'inbound' ? 'Them' : 'You'}: {message.body}
            </p>
          ))}
          {!selected && !error && <p className="text-muted-foreground text-sm">Select a thread to view messages.</p>}
        </div>
      </div>
    </div>
  );
}
