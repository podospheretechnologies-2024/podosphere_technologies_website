'use client';

import { useEffect, useState } from 'react';

interface Thread {
  id: string;
  platform: string;
  contactName: string | null;
  lastPreview: string | null;
}

interface Message {
  id: string;
  direction: string;
  body: string;
}

export function InboxPanel() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    void fetch('/api/social/inbox')
      .then(async (response) => {
        const payload = (await response.json()) as Thread[] | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : 'Could not load inbox');
        setThreads(payload as Thread[]);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ul className="border-border space-y-1 rounded-2xl border p-2">
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              className="hover:bg-surface-muted w-full rounded-xl px-3 py-2 text-left"
              onClick={() => {
                void fetch(`/api/social/inbox/${thread.id}`)
                  .then((response) => response.json())
                  .then((payload: { messages: Message[] }) => setMessages(payload.messages ?? []));
              }}
            >
              <p className="text-sm font-medium">{thread.contactName || thread.platform}</p>
              <p className="text-muted-foreground truncate text-xs">{thread.lastPreview}</p>
            </button>
          </li>
        ))}
        {threads.length === 0 && <li className="text-muted-foreground p-3 text-sm">No Page or Instagram messages yet.</li>}
      </ul>
      <div className="border-border min-h-80 space-y-2 rounded-2xl border p-4">
        {error && <p className="text-danger text-sm">{error}</p>}
        {messages.map((message) => (
          <p key={message.id} className="text-sm">{message.direction === 'inbound' ? 'Them' : 'You'}: {message.body}</p>
        ))}
      </div>
    </div>
  );
}
