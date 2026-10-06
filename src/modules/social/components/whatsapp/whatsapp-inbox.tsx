'use client';

import { MessageCircle, Search, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/shared/components/ui/button';
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

function initials(name: string | null | undefined, waId: string) {
  const source = (name?.trim() || waId).replace(/^\+/, '');
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function outboundOriginLabel(message: {
  source: string | null;
  senderLabel: string | null;
}): string | null {
  if (message.senderLabel?.trim()) {
    return message.senderLabel.trim();
  }
  if (message.source === 'podosocial') return 'PodoSocial';
  if (message.source === 'podocrm') return 'PodoCRM';
  return null;
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
    <section className="border-border bg-surface overflow-hidden rounded-2xl border">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="bg-success/15 text-success flex size-8 items-center justify-center rounded-xl">
            <MessageCircle className="size-3.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Inbox</h2>
            <p className="text-muted-foreground text-xs">
              {number.displayPhoneNumber} · {number.verifiedName}
            </p>
          </div>
        </div>
        <span className="bg-surface-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums">
          {conversations.length} chat{conversations.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid min-h-[540px] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-border flex flex-col border-b lg:border-r lg:border-b-0">
          <div className="p-3">
            <label className="border-border bg-surface-muted/50 focus-within:border-primary flex h-9 items-center gap-2 rounded-xl border px-2.5 transition">
              <Search className="text-muted-foreground size-3.5 shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search chats…"
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {isLoading && (
              <p className="text-muted-foreground px-3 py-6 text-sm">Loading chats…</p>
            )}
            {error && <p className="text-danger px-3 py-6 text-sm">{error.message}</p>}
            {!isLoading && !error && filtered.length === 0 && (
              <div className="text-muted-foreground space-y-2 px-3 py-10 text-center text-sm">
                <p className="text-foreground font-medium">No chats yet</p>
                <p className="text-xs leading-relaxed">
                  Sent messages show up here. Inbound chats need Meta webhooks on{' '}
                  <code className="text-[11px]">/api/webhooks/whatsapp</code>.
                </p>
              </div>
            )}
            <ul className="space-y-1">
              {filtered.map((item) => {
                const active = item.id === selectedId;
                const label = item.contactName || `+${item.waId}`;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition',
                        active
                          ? 'bg-success/10 ring-success/25 ring-1'
                          : 'hover:bg-surface-muted/70'
                      )}
                    >
                      <span className="bg-success/20 text-success flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                        {initials(item.contactName, item.waId)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {label}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                            {formatWhen(item.lastMessageAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                            {item.lastPreview || '—'}
                          </span>
                          {item.unreadCount > 0 && (
                            <span className="bg-success flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">
                              {item.unreadCount > 9 ? '9+' : item.unreadCount}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="flex min-h-[460px] flex-col">
          {!selectedId ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm">
              <MessageCircle className="size-8 opacity-40" />
              <p>Select a chat to read messages</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
              Loading messages…
            </div>
          ) : detail ? (
            <>
              <header className="border-border bg-surface flex items-center gap-3 border-b px-4 py-3">
                <span className="bg-success/20 text-success flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                  {initials(detail.conversation.contactName, detail.conversation.waId)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {detail.conversation.contactName || `+${detail.conversation.waId}`}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    +{detail.conversation.waId}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold',
                    detail.conversation.withinWindow
                      ? 'bg-success/15 text-success'
                      : 'bg-amber-500/15 text-amber-600'
                  )}
                >
                  {detail.conversation.withinWindow ? '24h open' : 'Use template'}
                </span>
              </header>

              <div
                className="relative flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 20% 20%, color-mix(in oklab, var(--success) 8%, transparent) 0, transparent 42%), radial-gradient(circle at 80% 0%, color-mix(in oklab, var(--primary) 6%, transparent) 0, transparent 36%)',
                }}
              >
                {detail.messages.length === 0 && (
                  <p className="text-muted-foreground py-10 text-center text-sm">
                    No messages in this chat.
                  </p>
                )}
                {detail.messages.map((message) => {
                  const outbound = message.direction === 'outbound';
                  const origin = outbound ? outboundOriginLabel(message) : null;
                  return (
                    <div
                      key={message.id}
                      className={cn('flex', outbound ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[min(80%,28rem)] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                          outbound
                            ? 'bg-success rounded-br-md text-white'
                            : 'bg-surface border-border text-foreground rounded-bl-md border'
                        )}
                      >
                        {origin && (
                          <p
                            className={cn(
                              'mb-1 text-[10px] font-semibold tracking-wide uppercase',
                              outbound ? 'text-white/80' : 'text-muted-foreground'
                            )}
                          >
                            {origin}
                          </p>
                        )}
                        <p>{message.body}</p>
                        <p
                          className={cn(
                            'mt-1 text-right text-[10px] tabular-nums',
                            outbound ? 'text-white/70' : 'text-muted-foreground'
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
                {!detail.conversation.withinWindow && (
                  <p className="text-amber-600 mb-2 text-xs">
                    Outside 24h window — free-form may fail. Use Compose → Template below.
                  </p>
                )}
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
                    rows={1}
                    placeholder={
                      detail.conversation.withinWindow
                        ? 'Type a reply…'
                        : 'Reply may fail outside 24h — prefer a template'
                    }
                    className="border-border placeholder:text-muted-foreground bg-surface-muted/40 min-h-[42px] min-w-0 flex-1 resize-none rounded-2xl border px-3.5 py-2.5 text-sm outline-none"
                  />
                  <Button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    title="Send"
                    className="size-10 shrink-0 rounded-full p-0"
                  >
                    <Send className="size-4" />
                    <span className="sr-only">{sending ? 'Sending' : 'Send'}</span>
                  </Button>
                </form>
              </footer>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
