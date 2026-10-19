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
  kind: 'comment' | 'dm' | null;
  contactName: string | null;
  lastPreview: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  slaDueAt: string | null;
  hiddenAt: string | null;
  aiLabel: string | null;
  aiPriority: string | null;
  aiSentiment: string | null;
  aiDraft: string | null;
  aiTriagedAt: string | null;
  overdue: boolean;
}

interface Message {
  id: string;
  direction: string;
  body: string;
  hiddenAt?: string | null;
}

interface SavedReply {
  id: string;
  title: string;
  body: string;
}

export function InboxPanel() {
  const scopeKey = useClientScopeKey();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [triaging, setTriaging] = useState(false);
  const [selectedKind, setSelectedKind] = useState<'comment' | 'dm' | null>(null);
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [selectedDraft, setSelectedDraft] = useState<string | null>(null);

  function loadThreads(filter = assigneeFilter, label = labelFilter) {
    const params = new URLSearchParams();
    if (filter === 'unassigned') params.set('assigneeId', 'unassigned');
    else if (filter !== 'all') params.set('assigneeId', filter);
    if (label !== 'all') params.set('aiLabel', label);
    const query = params.toString() ? `?${params.toString()}` : '';
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
    setSelectedKind(null);
    setSelectedDraft(null);
    setReplyText('');
    setError(null);
    void loadThreads(assigneeFilter, labelFilter);
  }, [scopeKey, assigneeFilter, labelFilter]);

  useEffect(() => {
    void fetch('/api/social/inbox/members')
      .then(async (response) => {
        const payload = (await response.json()) as Member[] | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : 'Could not load members');
        setMembers(payload as Member[]);
      })
      .catch((err: Error) => setError(err.message));
  }, [scopeKey]);

  useEffect(() => {
    void fetch('/api/social/saved-replies')
      .then(async (response) => {
        const payload = (await response.json()) as SavedReply[] | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : 'Could not load saved replies');
        setSavedReplies(payload as SavedReply[]);
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

  async function sendReply() {
    if (!selectedId || !replyText.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/social/inbox/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      const payload = (await response.json()) as
        | { message: Message; lastPreview?: string; kind?: 'comment' | 'dm' | null }
        | { error?: string };
      if (!response.ok) {
        setError('error' in payload ? (payload.error ?? 'Could not send reply') : 'Could not send reply');
        return;
      }
      const result = payload as { message: Message; lastPreview?: string; kind?: 'comment' | 'dm' | null };
      setMessages((prev) => [...prev, result.message]);
      setReplyText('');
      if (result.kind) setSelectedKind(result.kind);
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === selectedId
            ? {
                ...thread,
                lastPreview: result.lastPreview ?? result.message.body.slice(0, 500),
                kind: result.kind ?? thread.kind,
              }
            : thread
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reply');
    } finally {
      setSending(false);
    }
  }

  async function hideComment() {
    if (!selectedId || hiding) return;
    setHiding(true);
    setError(null);
    try {
      const response = await fetch(`/api/social/inbox/${selectedId}/hide`, { method: 'POST' });
      const payload = (await response.json()) as
        | { ok?: boolean; hiddenAt?: string | null; commentId?: string; error?: string }
        | { error?: string };
      if (!response.ok) {
        setError('error' in payload && payload.error ? payload.error : 'Could not hide comment');
        return;
      }
      const result = payload as { ok?: boolean; hiddenAt?: string | null };
      const hiddenAt = result.hiddenAt ?? new Date().toISOString();
      setThreads((prev) =>
        prev.map((thread) => (thread.id === selectedId ? { ...thread, hiddenAt } : thread))
      );
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].direction === 'inbound' && !next[i].hiddenAt) {
            next[i] = { ...next[i], hiddenAt };
            break;
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hide comment');
    } finally {
      setHiding(false);
    }
  }

  async function runTriage() {
    if (!selectedId || triaging) return;
    setTriaging(true);
    setError(null);
    try {
      const response = await fetch(`/api/social/inbox/${selectedId}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeDraft: true }),
      });
      const payload = (await response.json()) as Thread | { error?: string };
      if (!response.ok) {
        setError('error' in payload ? (payload.error ?? 'Could not triage') : 'Could not triage');
        return;
      }
      const updated = payload as Thread;
      setThreads((prev) => prev.map((thread) => (thread.id === selectedId ? { ...thread, ...updated } : thread)));
      setSelectedDraft(updated.aiDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not triage');
    } finally {
      setTriaging(false);
    }
  }

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const canHide = (selectedKind ?? selected?.kind) === 'comment' && !selected?.hiddenAt;
  const draftText = selectedDraft ?? selected?.aiDraft ?? null;

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
        <label className="text-muted-foreground text-xs" htmlFor="inbox-label-filter">
          Label
        </label>
        <select
          id="inbox-label-filter"
          className="border-border bg-background rounded-lg border px-2 py-1 text-sm"
          value={labelFilter}
          onChange={(event) => setLabelFilter(event.target.value)}
        >
          <option value="all">All labels</option>
          <option value="question">Question</option>
          <option value="complaint">Complaint</option>
          <option value="lead">Lead</option>
          <option value="spam">Spam</option>
          <option value="praise">Praise</option>
          <option value="other">Other</option>
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
                  setSelectedKind(thread.kind);
                  setSelectedDraft(thread.aiDraft);
                  setReplyText('');
                  setError(null);
                  void fetch(`/api/social/inbox/${thread.id}`)
                    .then((response) => response.json())
                    .then(
                      (payload: {
                        messages: Message[];
                        kind?: 'comment' | 'dm' | null;
                        hiddenAt?: string | null;
                        aiDraft?: string | null;
                        aiLabel?: string | null;
                        aiPriority?: string | null;
                        aiSentiment?: string | null;
                        aiTriagedAt?: string | null;
                      }) => {
                        setMessages(payload.messages ?? []);
                        if (payload.kind === 'comment' || payload.kind === 'dm') {
                          setSelectedKind(payload.kind);
                        }
                        setSelectedDraft(payload.aiDraft ?? null);
                        setThreads((prev) =>
                          prev.map((row) =>
                            row.id === thread.id
                              ? {
                                  ...row,
                                  hiddenAt: payload.hiddenAt ?? row.hiddenAt,
                                  aiDraft: payload.aiDraft ?? row.aiDraft,
                                  aiLabel: payload.aiLabel ?? row.aiLabel,
                                  aiPriority: payload.aiPriority ?? row.aiPriority,
                                  aiSentiment: payload.aiSentiment ?? row.aiSentiment,
                                  aiTriagedAt: payload.aiTriagedAt ?? row.aiTriagedAt,
                                }
                              : row
                          )
                        );
                      }
                    );
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{thread.contactName || thread.platform}</p>
                  <div className="flex shrink-0 items-center gap-1">
                    {thread.aiLabel && (
                      <span className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize">
                        {thread.aiLabel}
                      </span>
                    )}
                    {thread.aiPriority && thread.aiPriority !== 'normal' && (
                      <span className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        {thread.aiPriority}
                      </span>
                    )}
                    {thread.hiddenAt && (
                      <span className="border-border text-muted-foreground rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        Hidden
                      </span>
                    )}
                    {thread.overdue && (
                      <span className="border-danger/40 bg-danger/10 text-danger rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground truncate text-xs">{thread.lastPreview}</p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  {thread.assigneeName ? `Assigned: ${thread.assigneeName}` : 'Unassigned'}
                  {thread.aiSentiment ? ` · ${thread.aiSentiment}` : ''}
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
              {selected.hiddenAt && (
                <span className="text-muted-foreground text-xs">Comment hidden</span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="border-border text-muted-foreground hover:bg-surface-muted rounded-lg border px-2 py-1 text-xs"
                  disabled={triaging}
                  onClick={() => {
                    void runTriage();
                  }}
                >
                  {triaging ? 'Triaging…' : selected?.aiTriagedAt ? 'Re-triage' : 'AI triage'}
                </button>
                {canHide && (
                  <button
                    type="button"
                    className="border-border text-muted-foreground hover:bg-surface-muted rounded-lg border px-2 py-1 text-xs"
                    disabled={hiding}
                    onClick={() => {
                      void hideComment();
                    }}
                  >
                    {hiding ? 'Hiding…' : 'Hide comment'}
                  </button>
                )}
              </div>
            </div>
          )}
          {selected && (selected.aiLabel || selected.aiPriority || selected.aiSentiment) && (
            <p className="text-muted-foreground text-xs">
              Triage: {[selected.aiLabel, selected.aiPriority, selected.aiSentiment].filter(Boolean).join(' · ')}
            </p>
          )}
          {messages.map((message) => (
            <p key={message.id} className={`text-sm ${message.hiddenAt ? 'text-muted-foreground line-through' : ''}`}>
              {message.direction === 'inbound' ? 'Them' : 'You'}: {message.body}
              {message.hiddenAt ? ' (hidden)' : ''}
            </p>
          ))}
          {selected && (
            <div className="border-border space-y-2 border-t pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-muted-foreground text-xs" htmlFor="inbox-reply">
                  Reply
                </label>
                {savedReplies.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-muted-foreground text-xs" htmlFor="inbox-saved-reply">
                      Saved reply
                    </label>
                    <select
                      id="inbox-saved-reply"
                      className="border-border bg-background max-w-56 rounded-lg border px-2 py-1 text-xs"
                      defaultValue=""
                      disabled={sending}
                      onChange={(event) => {
                        const reply = savedReplies.find((item) => item.id === event.target.value);
                        if (reply) setReplyText(reply.body);
                        event.target.value = '';
                      }}
                    >
                      <option value="">Insert…</option>
                      {savedReplies.map((reply) => (
                        <option key={reply.id} value={reply.id}>
                          {reply.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <textarea
                id="inbox-reply"
                className="border-border bg-background min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                value={replyText}
                placeholder="Write a reply…"
                onChange={(event) => setReplyText(event.target.value)}
                disabled={sending}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="bg-foreground text-background rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
                  disabled={sending || !replyText.trim()}
                  onClick={() => {
                    void sendReply();
                  }}
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
                {draftText && (
                  <button
                    type="button"
                    className="border-border text-muted-foreground hover:bg-surface-muted rounded-lg border px-3 py-1.5 text-sm"
                    disabled={sending}
                    onClick={() => setReplyText(draftText)}
                  >
                    Use draft
                  </button>
                )}
              </div>
            </div>
          )}
          {!selected && !error && <p className="text-muted-foreground text-sm">Select a thread to view messages.</p>}
        </div>
      </div>
    </div>
  );
}
