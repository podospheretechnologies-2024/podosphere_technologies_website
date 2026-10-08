'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface CopilotReply {
  reply: string;
  draftPost: string;
  needsApproval: boolean;
}

export function CopilotPanel() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<CopilotReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/social/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as CopilotReply & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Copilot failed');
      setReply(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copilot failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendForApproval() {
    if (!reply?.draftPost) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/social/ai/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.draftPost }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not save the draft');
      setError(null);
      setReply((current) => (current ? { ...current, reply: `${current.reply}\n\nSaved as a draft for approval.` } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the draft');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-border bg-surface space-y-3 rounded-2xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Copilot</h2>
        <p className="text-muted-foreground text-xs">Ask for a post. Approval saves a draft; nothing publishes on its own.</p>
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={3}
        placeholder="Write a LinkedIn post about our WhatsApp onboarding offer"
        className="border-border bg-surface-muted/40 w-full rounded-xl border px-3 py-2 text-sm outline-none"
      />
      <Button type="button" onClick={() => void ask()} disabled={busy || !message.trim()}>
        {busy ? 'Working…' : 'Ask copilot'}
      </Button>
      {error && <p className="text-danger text-xs">{error}</p>}
      {reply && (
        <div className="bg-surface-muted/50 space-y-2 rounded-xl p-3 text-sm">
          <p className="whitespace-pre-wrap">{reply.reply}</p>
          {reply.draftPost && (
            <>
              <p className="border-border border-t pt-2 whitespace-pre-wrap">{reply.draftPost}</p>
              <Button type="button" variant="secondary" onClick={() => void sendForApproval()} disabled={busy}>
                Send draft for approval
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
