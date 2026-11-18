'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import type {
  PortalInboxMessageRow,
  PortalInboxSummary,
  PortalInboxThreadDetail,
  PortalInboxThreadRow,
} from '@/modules/social/server/portal/portal-inbox.service';

function platformLabel(platform: string): string {
  if (platform === 'instagram') return 'Instagram';
  if (platform === 'facebook') return 'Facebook';
  return platform;
}

function kindLabel(kind: PortalInboxThreadRow['kind']): string {
  if (kind === 'comment') return 'Comment';
  if (kind === 'dm') return 'DM';
  return 'Message';
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PortalInboxPanel({
  data,
  canAct = false,
}: {
  data: PortalInboxSummary;
  /** True when the agency set Inbox to "Can act". */
  canAct?: boolean;
}) {
  const [threads, setThreads] = useState(data.threads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PortalInboxThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openThread(threadId: string) {
    setSelectedId(threadId);
    setLoading(true);
    setError(null);
    setReplyText('');
    try {
      const payload = await apiFetch<PortalInboxThreadDetail>(`/api/portal/inbox/${threadId}`);
      setDetail(payload);
    } catch (err) {
      setDetail(null);
      setError(err instanceof ApiError ? err.message : 'Could not load thread');
    } finally {
      setLoading(false);
    }
  }

  function closeThread() {
    setSelectedId(null);
    setDetail(null);
    setError(null);
    setReplyText('');
  }

  async function sendReply() {
    if (!selectedId || !canAct) return;
    const text = replyText.trim();
    if (!text) return;

    setSending(true);
    setError(null);
    try {
      const res = await apiFetch<{
        thread: PortalInboxThreadRow;
        message: PortalInboxMessageRow;
      }>(`/api/portal/inbox/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      setThreads((rows) =>
        rows.map((row) => (row.id === res.thread.id ? { ...row, ...res.thread } : row))
      );
      setDetail((current) =>
        current && current.id === res.thread.id
          ? {
              ...current,
              ...res.thread,
              messages: [...current.messages, res.message],
            }
          : current
      );
      setReplyText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send reply.');
    } finally {
      setSending(false);
    }
  }

  const messages: PortalInboxMessageRow[] = detail?.messages ?? [];

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">Inbox</h2>
        <p className="mt-1 text-muted-foreground">
          {canAct
            ? 'Comments and DMs on your channels — open a thread and reply.'
            : 'Comments and DMs on your channels (view only).'}
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
          No messages yet for your brand.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface max-h-[70vh] overflow-y-auto">
            {threads.map((thread) => {
              const active = thread.id === selectedId;
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => void openThread(thread.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                      active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium text-foreground">
                        {thread.contactName || 'Unknown contact'}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatWhen(thread.lastMessageAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {thread.preview || 'No preview'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-foreground">
                        {platformLabel(thread.platform)}
                      </span>
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-foreground">
                        {kindLabel(thread.kind)}
                      </span>
                      {thread.awaitingReply ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                          Awaiting reply
                          {thread.unreadCount > 1 ? ` · ${thread.unreadCount}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="rounded-xl border border-border bg-surface">
            {!selectedId ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Select a conversation to read the messages.
              </div>
            ) : loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : error && !detail ? (
              <div className="p-8 text-center text-sm text-red-600">{error}</div>
            ) : detail ? (
              <div className="flex h-full min-h-[280px] flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {detail.contactName || 'Unknown contact'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {platformLabel(detail.platform)} · {kindLabel(detail.kind)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeThread}
                    className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground lg:hidden"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 max-h-[50vh]">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages in this thread.</p>
                  ) : (
                    messages.map((message) => {
                      const outbound = message.direction === 'outbound';
                      return (
                        <div
                          key={message.id}
                          className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                              outbound
                                ? 'bg-foreground text-background'
                                : 'bg-surface-muted text-foreground'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                            <p
                              className={`mt-1 text-[10px] ${
                                outbound ? 'text-background/70' : 'text-muted-foreground'
                              }`}
                            >
                              {formatWhen(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {canAct ? (
                  <div className="border-t border-border px-4 py-3">
                    {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
                    <label className="block text-xs font-medium text-muted-foreground">
                      Reply
                      <textarea
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                        rows={3}
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Write a reply…"
                        maxLength={8000}
                        disabled={sending}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={sending || !replyText.trim()}
                      className="mt-2 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                    >
                      {sending ? 'Sending…' : 'Send reply'}
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                    Your agency has set Inbox to view only. Ask them to enable “Can act” if you need
                    to reply.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
