'use client';

import { Search, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import { fetcher } from '@/shared/lib/fetcher';
import { WHATSAPP_API_ROUTE } from '../../hooks/use-whatsapp';
import { sendWhatsAppMessage } from '../../lib/whatsapp.client';
import type {
  WhatsAppConversationDetail,
  WhatsAppConversationItem,
  WhatsAppNumber,
} from '../../types/whatsapp';

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function WhatsAppInbox({ number }: { number: WhatsAppNumber }) {
  const {
    data: conversations = [],
    error,
    isLoading,
    mutate: mutateList,
  } = useSWR<WhatsAppConversationItem[]>(`${WHATSAPP_API_ROUTE}/conversations`, fetcher, {
    refreshInterval: 15_000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return conversations;
    }
    return conversations.filter(
      (item) =>
        item.waId.includes(q) ||
        (item.contactName?.toLowerCase().includes(q) ?? false) ||
        (item.lastPreview?.toLowerCase().includes(q) ?? false)
    );
  }, [conversations, search]);

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const detailKey = selectedId ? `${WHATSAPP_API_ROUTE}/conversations/${selectedId}` : null;
  const {
    data: detail,
    mutate: mutateDetail,
    isLoading: detailLoading,
  } = useSWR<WhatsAppConversationDetail>(detailKey, fetcher, {
    refreshInterval: 8_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages.length, selectedId]);

  async function reply() {
    if (!detail || !draft.trim()) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await sendWhatsAppMessage({
        type: 'text',
        to: detail.conversation.waId,
        text: draft.trim(),
      });
      setDraft('');
      await Promise.all([mutateDetail(), mutateList()]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Chats</h2>
          <p className="text-muted-foreground text-xs">
            Inbox for {number.displayPhoneNumber} · {number.verifiedName}
          </p>
        </div>
        <span className="text-muted-foreground text-xs">
          {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid min-h-[480px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-border flex flex-col border-b lg:border-r lg:border-b-0">
          <label className="border-border focus-within:border-primary m-3 flex h-9 items-center gap-2 rounded-lg border px-2.5">
            <Search className="text-muted-foreground size-3.5 shrink-0" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats…"
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <p className="text-muted-foreground px-4 py-6 text-sm">Loading chats…</p>
            )}
            {error && (
              <p className="text-danger px-4 py-6 text-sm">{error.message}</p>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <div className="text-muted-foreground space-y-2 px-4 py-8 text-center text-sm">
                <p className="text-foreground font-medium">No chats yet</p>
                <p>
                  Messages you send from here appear in this inbox. Inbound chats arrive when Meta
                  webhooks point to <code className="text-xs">/api/webhooks/whatsapp</code>.
                </p>
              </div>
            )}
            <ul>
              {filtered.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'hover:bg-surface-muted flex w-full flex-col gap-0.5 px-4 py-3 text-left transition',
                        active && 'bg-surface-muted'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {item.contactName || `+${item.waId}`}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[10px]">
                          {formatWhen(item.lastMessageAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                          {item.lastPreview || '—'}
                        </span>
                        {item.unreadCount > 0 && (
                          <span className="bg-success flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">
                            {item.unreadCount > 9 ? '9+' : item.unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="bg-surface-muted/20 flex min-h-[420px] flex-col">
          {!selectedId ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
              Select a chat to read messages
            </div>
          ) : detailLoading && !detail ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
              Loading messages…
            </div>
          ) : detail ? (
            <>
              <header className="border-border bg-surface flex items-center justify-between gap-3 border-b px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {detail.conversation.contactName || `+${detail.conversation.waId}`}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    +{detail.conversation.waId}
                    {detail.conversation.withinWindow
                      ? ' · Free-form replies open (24h window)'
                      : ' · Outside 24h window — use a template to restart'}
                  </p>
                </div>
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
                {detail.messages.length === 0 && (
                  <p className="text-muted-foreground text-center text-sm">No messages in this chat.</p>
                )}
                {detail.messages.map((message) => {
                  const outbound = message.direction === 'outbound';
                  return (
                    <div
                      key={message.id}
                      className={cn('flex', outbound ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm',
                          outbound
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-surface border-border rounded-bl-md border'
                        )}
                      >
                        <p>{message.body}</p>
                        <p
                          className={cn(
                            'mt-1 text-[10px]',
                            outbound ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}
                        >
                          {formatWhen(message.timestamp)}
                          {message.status ? ` · ${message.status}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <footer className="border-border bg-surface border-t p-3">
                {sendError && (
                  <p className="text-danger mb-2 text-xs" role="alert">
                    {sendError}
                  </p>
                )}
                <form
                  className="flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void reply();
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    placeholder={
                      detail.conversation.withinWindow
                        ? 'Type a reply…'
                        : 'Customer outside 24h window — free-form may fail; use Send a message → Template below'
                    }
                    className="border-border placeholder:text-muted-foreground min-h-[44px] min-w-0 flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                  />
                  <Button type="submit" disabled={sending || !draft.trim()} title="Send">
                    <Send className="size-4" />
                    {sending ? '…' : 'Send'}
                  </Button>
                </form>
              </footer>
            </>
          ) : null}
        </section>
      </div>
    </Card>
  );
}
