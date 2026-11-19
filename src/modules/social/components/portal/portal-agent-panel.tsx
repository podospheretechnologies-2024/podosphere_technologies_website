'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import { cn } from '@/shared/lib/cn';
import {
  AI_PROVIDER_OPTIONS,
  GEMINI_MODEL_OPTIONS,
  type AiProvider,
} from '../../config/ai';

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

type ProviderDisplay = {
  configured: boolean;
  provider: AiProvider | null;
  model: string | null;
  keyLast4: string | null;
};

export function PortalAgentPanel({
  configured,
  provider: initialProvider,
  initialThreads,
  canAct = false,
}: {
  configured: boolean;
  provider: ProviderDisplay;
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
  const [providerInfo, setProviderInfo] = useState(initialProvider);
  const [showSettings, setShowSettings] = useState(!configured);
  /** On phone, show either the thread list or the chat pane — not both. */
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>(
    initialThreads.length === 0 ? 'chat' : 'list'
  );

  const [provider, setProvider] = useState<AiProvider>(
    initialProvider.provider ?? 'gemini'
  );
  const [model, setModel] = useState(initialProvider.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);

  async function openThread(id: string) {
    if (id === activeId && messages.length > 0) {
      setMobilePane('chat');
      return;
    }
    setLoadingThread(true);
    setError(null);
    setMobilePane('chat');
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
    setMobilePane('chat');
  }

  function backToList() {
    setMobilePane('list');
  }

  async function saveProvider() {
    if (savingKey) return;
    if (!providerInfo.configured && !apiKey.trim()) {
      setKeyStatus('Enter your API key — each client must add their own.');
      return;
    }
    setSavingKey(true);
    setKeyStatus(null);
    try {
      const next = await apiFetch<ProviderDisplay>('/api/portal/agent/provider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim() || undefined,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });
      setProviderInfo(next);
      setAiReady(next.configured);
      setApiKey('');
      setShowKey(false);
      setKeyStatus(
        next.keyLast4
          ? `Saved. Using key ending in …${next.keyLast4}.`
          : 'Saved.'
      );
      if (next.configured) setShowSettings(false);
    } catch (err) {
      setKeyStatus(err instanceof ApiError ? err.message : 'Could not save your API key.');
    } finally {
      setSavingKey(false);
    }
  }

  async function send() {
    const text = message.trim();
    if (!text || !canAct || busy) return;
    setBusy(true);
    setError(null);
    const optimistic: ThreadMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setMessage('');
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
        setShowSettings(true);
      }
      setActiveId(thread.id);
      setMessages(thread.messages ?? []);
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
      setMessages((current) => current.filter((row) => row.id !== optimistic.id));
      setMessage(text);
      const msg = err instanceof ApiError ? err.message : 'Could not send message.';
      setError(msg);
      if (err instanceof ApiError && err.status === 503) {
        setAiReady(false);
        setShowSettings(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const providerOption = AI_PROVIDER_OPTIONS.find((item) => item.value === provider);

  const setupForm = (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-base font-medium text-foreground">
        {aiReady ? 'Update your AI API key' : 'Add your AI API key to use Agent'}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Every client must connect their own key. Your agency’s key is never used for your chat.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-foreground">Provider</span>
          <select
            value={provider}
            onChange={(event) => {
              const next = event.target.value as AiProvider;
              setProvider(next);
              if (next === 'gemini' && !GEMINI_MODEL_OPTIONS.some((o) => o.value === model)) {
                setModel('gemini-3-flash-preview');
              }
            }}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/40"
          >
            {AI_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-foreground">Model (optional)</span>
          {provider === 'gemini' ? (
            <select
              value={model || 'gemini-3-flash-preview'}
              onChange={(event) => setModel(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/40"
            >
              {GEMINI_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={providerOption?.modelPlaceholder}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/40"
            />
          )}
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block font-medium text-foreground">API key</span>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              providerInfo.keyLast4
                ? `Saved key ends in …${providerInfo.keyLast4} — paste a new key to replace`
                : providerOption?.keyHint
            }
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 pr-10 text-sm outline-none focus:border-foreground/40"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </label>

      {keyStatus ? (
        <p
          className={cn(
            'mt-3 text-sm',
            keyStatus.startsWith('Saved') ? 'text-muted-foreground' : 'text-red-600'
          )}
        >
          {keyStatus}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void saveProvider()}
          disabled={savingKey}
          className="min-h-11 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {savingKey ? 'Saving…' : aiReady ? 'Update key' : 'Save and continue'}
        </button>
        {aiReady ? (
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Back to chat
          </button>
        ) : null}
      </div>
    </div>
  );

  if (!aiReady || showSettings) {
    return (
      <>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">Agent</h2>
          <p className="mt-1 text-muted-foreground">Ask about your posts, analytics, and leads.</p>
        </div>
        {setupForm}
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Agent</h2>
          <p className="mt-1 text-muted-foreground">
            Ask the agent about your channels, posts, and leads. Answers stay limited to your
            account.
          </p>
          {providerInfo.keyLast4 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Using your {providerInfo.provider ?? 'AI'} key ending in …{providerInfo.keyLast4}.{' '}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Change key
              </button>
            </p>
          ) : null}
        </div>
        {canAct && (activeId || messages.length > 0) ? (
          <button
            type="button"
            onClick={startNewChat}
            disabled={busy}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-muted disabled:opacity-50"
          >
            New chat
          </button>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside
          className={`rounded-xl border border-border bg-surface p-3 shadow-sm ${
            mobilePane === 'chat' ? 'hidden lg:block' : 'block'
          }`}
        >
          <p className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Recent
          </p>
          {threads.length === 0 ? (
            <p className="px-1 py-4 text-sm text-muted-foreground">No chats yet.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto lg:max-h-none">
              {threads.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openThread(row.id)}
                    className={
                      row.id === activeId
                        ? 'min-h-11 w-full rounded-lg bg-foreground px-3 py-2 text-left text-sm font-medium text-background'
                        : 'min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-surface-muted'
                    }
                  >
                    <span className="line-clamp-2">{row.title?.trim() || 'Untitled chat'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canAct ? (
            <button
              type="button"
              onClick={startNewChat}
              disabled={busy}
              className="mt-3 min-h-11 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50 lg:hidden"
            >
              New chat
            </button>
          ) : null}
        </aside>

        <section
          className={`flex min-h-[calc(100vh-14rem)] min-w-0 flex-col rounded-xl border border-border bg-surface shadow-sm sm:min-h-[28rem] ${
            mobilePane === 'list' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 lg:hidden">
            <button
              type="button"
              onClick={backToList}
              className="min-h-10 px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Chats
            </button>
            {canAct && (activeId || messages.length > 0) ? (
              <button
                type="button"
                onClick={startNewChat}
                disabled={busy}
                className="min-h-10 px-2 text-sm font-medium text-foreground disabled:opacity-50"
              >
                New
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto p-4">
            {loadingThread ? (
              <p className="text-sm text-muted-foreground">Loading chat…</p>
            ) : messages.length === 0 ? (
              <div className="mx-auto max-w-xl space-y-3 pt-10 text-center text-sm leading-relaxed text-muted-foreground">
                <p className="text-base font-medium text-foreground">
                  Ask the agent about your posts, analytics, or leads.
                </p>
                <p>
                  {canAct
                    ? 'Try: “How did our Instagram posts perform this month?” or “What posts are scheduled next week?”'
                    : 'No messages in this chat yet. Ask your agency for chat access to send one.'}
                </p>
              </div>
            ) : (
              messages.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    'flex flex-col gap-2',
                    row.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[min(100%,40rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      row.role === 'user'
                        ? 'bg-surface-muted text-foreground'
                        : 'border border-border bg-surface text-foreground'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{row.text || '(no text)'}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {canAct ? (
            <div className="border-t border-border p-4">
              {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder="e.g. How did our Instagram posts perform this month?"
                className="w-full rounded-xl border border-border bg-surface-muted/40 px-3 py-2 text-sm outline-none focus:border-foreground/40"
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
                  className="min-h-11 w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                  {busy ? 'Working…' : activeId ? 'Send' : 'Ask agent'}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              View only — ask your agency to set Agent to &quot;Can act&quot; if you need to chat.
              {error ? <p className="mt-1 text-red-600">{error}</p> : null}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
