'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface ThreadMessage {
  id: string;
  role: string;
  text: string;
  createdAt: string;
}

interface ThreadAction {
  id: string;
  toolName: string;
  payload: unknown;
  status: string;
  createdAt: string;
}

interface ThreadPayload {
  id: string;
  messages: ThreadMessage[];
  actions: ThreadAction[];
  replyText?: string;
  configured?: boolean;
  error?: string;
}

function draftContent(action: ThreadAction): string {
  if (!action.payload || typeof action.payload !== 'object') return '';
  const content = (action.payload as { content?: unknown }).content;
  return typeof content === 'string' ? content : '';
}

export function CopilotPanel() {
  const [message, setMessage] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [actions, setActions] = useState<ThreadAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pendingDrafts = actions.filter(
    (action) => action.status === 'pending' && action.toolName === 'create_post_draft'
  );

  function applyThread(thread: ThreadPayload) {
    setThreadId(thread.id);
    setMessages(thread.messages ?? []);
    setActions(thread.actions ?? []);
  }

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      let activeThreadId = threadId;
      if (!activeThreadId) {
        const createResponse = await fetch('/api/social/ai/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: message.trim().slice(0, 80) }),
        });
        const created = (await createResponse.json()) as ThreadPayload;
        if (!createResponse.ok) throw new Error(created.error || 'Could not start chat');
        activeThreadId = created.id;
        setThreadId(created.id);
      }

      const response = await fetch(`/api/social/ai/threads/${activeThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as ThreadPayload;
      if (!response.ok) throw new Error(payload.error || 'Copilot failed');
      applyThread(payload);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copilot failed');
    } finally {
      setBusy(false);
    }
  }

  async function approveAction(actionId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/social/ai/actions/${actionId}/approve`, {
        method: 'POST',
      });
      const payload = (await response.json()) as { error?: string; status?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not approve');
      setActions((current) =>
        current.map((action) =>
          action.id === actionId ? { ...action, status: payload.status || 'approved' } : action
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve');
    } finally {
      setBusy(false);
    }
  }

  function startNewChat() {
    setThreadId(null);
    setMessages([]);
    setActions([]);
    setMessage('');
    setError(null);
  }

  return (
    <section className="border-border bg-surface space-y-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Copilot</h2>
          <p className="text-muted-foreground text-xs">
            Multi-turn chat for this client. Write actions queue for approval; nothing publishes on its own.
          </p>
        </div>
        {(threadId || messages.length > 0) && (
          <Button type="button" variant="secondary" onClick={startNewChat} disabled={busy}>
            New chat
          </Button>
        )}
      </div>

      {messages.length > 0 && (
        <div className="bg-surface-muted/40 max-h-80 space-y-2 overflow-y-auto rounded-xl p-3">
          {messages.map((row) => (
            <div key={row.id} className={row.role === 'assistant' ? 'border-border border-t pt-2 text-sm' : 'text-sm'}>
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {row.role === 'user' ? 'You' : 'Copilot'}
              </p>
              <p className="whitespace-pre-wrap">{row.text || '(no text)'}</p>
            </div>
          ))}
        </div>
      )}

      {pendingDrafts.length > 0 && (
        <div className="border-border space-y-2 rounded-xl border border-dashed p-3">
          <p className="text-xs font-medium">Pending draft approvals</p>
          {pendingDrafts.map((action) => (
            <div key={action.id} className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap">{draftContent(action)}</p>
              <Button type="button" variant="secondary" onClick={() => void approveAction(action.id)} disabled={busy}>
                Approve draft
              </Button>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={3}
        placeholder="Write a LinkedIn post about our WhatsApp onboarding offer"
        className="border-border bg-surface-muted/40 w-full rounded-xl border px-3 py-2 text-sm outline-none"
      />
      <Button type="button" onClick={() => void ask()} disabled={busy || !message.trim()}>
        {busy ? 'Working…' : threadId ? 'Send' : 'Ask copilot'}
      </Button>
      {error && <p className="text-danger text-xs">{error}</p>}
    </section>
  );
}
