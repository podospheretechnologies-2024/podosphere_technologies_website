'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

type ThreadSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

type ThreadMessage = {
  id: string;
  role: string;
  text: string;
  createdAt: string;
};

type ThreadPayload = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
  configured?: boolean;
  replyText?: string;
};

export function PortalAgentPanel({
  configured,
  initialThreads,
  canAct = false,
}: {
  configured: boolean;
  initialThreads: ThreadSummary[];
  /** False when the agency set Agent to "View only": browse history, no new messages. */
  canAct?: boolean;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(initialThreads[0]?.id ?? null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiReady, setAiReady] = useState(configured);

  async function openThread(id: string) {
    if (id === activeId && messages.length > 0) return;
    setLoadingThread(true);
    setError(null);
    try {
      const res = await apiFetch<{ thread: ThreadPayload }>(`/api/portal/agent/threads/${id}`);
      setActiveId(res.thread.id);
      setMessages(res.thread.messages ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open chat.');
    } finally {
      setLoadingThread(false);
    }
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setMessage('');
    setError(null);
  }

  async function send() {
    const text = message.trim();
    if (!text || !canAct || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ thread: ThreadPayload }>('/api/portal/agent/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          ...(activeId ? { threadId: activeId } : {}),
        }),
      });
      const thread = res.thread;
      if (thread.configured === false) {
        setAiReady(false);
      }
      setActiveId(thread.id);
      setMessages(thread.messages ?? []);
      setMessage('');
      setThreads((rows) => {
        const next: ThreadSummary = {
          id: thread.id,
          title: thread.title,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        };
        const without = rows.filter((row) => row.id !== thread.id);
        return [next, ...without];
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send message.');
    } finally {
      setBusy(false);
    }
  }

  if (!aiReady) {
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Agent</h2>
          <p className="mt-1 text-gray-500">Ask about your posts, analytics, and leads.</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-medium text-gray-900">AI is not set up yet</p>
          <p className="mt-2 text-sm text-gray-500">
            Your agency still needs to connect an AI provider. Chat will appear here once that is
            done — nothing is wrong on your side.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agent</h2>
          <p className="mt-1 text-gray-500">
            Chat about your channels, posts, and leads. Answers stay limited to your account.
          </p>
        </div>
        {canAct && (activeId || messages.length > 0) ? (
          <button
            type="button"
            onClick={startNewChat}
            disabled={busy}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            New chat
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-2 px-1 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Recent
          </p>
          {threads.length === 0 ? (
            <p className="px-1 py-4 text-sm text-gray-500">No chats yet.</p>
          ) : (
            <ul className="space-y-1">
              {threads.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openThread(row.id)}
                    className={
                      row.id === activeId
                        ? 'w-full rounded-lg bg-gray-900 px-3 py-2 text-left text-sm font-medium text-white'
                        : 'w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
                    }
                  >
                    <span className="line-clamp-2">{row.title?.trim() || 'Untitled chat'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[420px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {loadingThread ? (
              <p className="text-sm text-gray-500">Loading chat…</p>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
                {canAct
                  ? 'Ask a question about your posts, analytics, or leads to start.'
                  : 'No messages in this chat yet. Ask your agency for chat access to send one.'}
              </p>
            ) : (
              messages.map((row) => (
                <div
                  key={row.id}
                  className={
                    row.role === 'assistant'
                      ? 'rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900'
                      : 'px-1 text-sm text-gray-900'
                  }
                >
                  <p className="mb-1 text-[11px] font-medium tracking-wide text-gray-500 uppercase">
                    {row.role === 'user' ? 'You' : 'Agent'}
                  </p>
                  <p className="whitespace-pre-wrap">{row.text || '(no text)'}</p>
                </div>
              ))
            )}
          </div>

          {canAct ? (
            <div className="border-t border-gray-100 p-4">
              {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="e.g. How did our Instagram posts perform this month?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                disabled={busy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy || !message.trim()}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {busy ? 'Working…' : 'Send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
              View only — ask your agency to set Agent to &quot;Can act&quot; if you need to chat.
              {error ? <p className="mt-1 text-red-600">{error}</p> : null}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
