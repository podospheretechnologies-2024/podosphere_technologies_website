'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Lock,
  MessageCircle,
  Search,
  SendHorizontal,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { cn } from '@/shared/lib/cn';
import { fetcher } from '@/shared/lib/fetcher';
import { useClientScopeKey } from '../../hooks/use-client-scope';
import { WHATSAPP_API_ROUTE } from '../../hooks/use-whatsapp';
import { sendWhatsAppMessage } from '../../lib/whatsapp.client';
import type {
  WhatsAppChatMessage,
  WhatsAppConversationDetail,
  WhatsAppConversationItem,
  WhatsAppNumber,
} from '../../types/whatsapp';

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPOSER_MAX_HEIGHT = 140;

type ChatFilter = 'all' | 'unread' | 'open';

const CHAT_FILTERS: { value: ChatFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'open', label: '24h open' },
];

// Solid fills with white text read well on both the dark and light workspace.
const AVATAR_TONES = [
  'bg-emerald-600',
  'bg-sky-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-indigo-600',
];

const WALLPAPER_STYLE = {
  backgroundImage:
    'radial-gradient(color-mix(in oklab, var(--foreground) 7%, transparent) 1px, transparent 1px)',
  backgroundSize: '18px 18px',
};

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) {
    return formatTime(iso);
  }
  if (isSameDay(date, new Date(now.getTime() - DAY_MS))) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, new Date(now.getTime() - DAY_MS))) return 'Yesterday';
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** "5h 12m left" while the customer-service window is open, null once it has closed. */
function windowRemaining(lastInboundAt: string | null) {
  if (!lastInboundAt) return null;
  const left = new Date(lastInboundAt).getTime() + DAY_MS - Date.now();
  if (left <= 0) return null;
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

function initials(name: string | null | undefined, waId: string) {
  const source = (name?.trim() || waId).replace(/^\+/, '');
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function avatarTone(waId: string) {
  let hash = 0;
  for (const char of waId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
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

function Avatar({
  name,
  waId,
  size = 'md',
}: {
  name: string | null;
  waId: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        avatarTone(waId),
        size === 'md' ? 'size-11 text-sm' : 'size-9 text-xs'
      )}
    >
      {initials(name, waId)}
    </span>
  );
}

function StatusTicks({ status }: { status: string | null }) {
  switch (status) {
    case 'read':
      return <CheckCheck className="text-wa-tick-read size-3.5" aria-label="Read" />;
    case 'delivered':
      return <CheckCheck className="size-3.5 opacity-70" aria-label="Delivered" />;
    case 'sent':
      return <Check className="size-3.5 opacity-70" aria-label="Sent" />;
    case 'failed':
      return <AlertCircle className="text-danger size-3.5" aria-label="Failed" />;
    default:
      return <Clock className="size-3 opacity-60" aria-label="Pending" />;
  }
}

function MessageBubble({
  message,
  startsRun,
}: {
  message: WhatsAppChatMessage;
  startsRun: boolean;
}) {
  const outbound = message.direction === 'outbound';
  const origin = outbound ? outboundOriginLabel(message) : null;

  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start', startsRun && 'mt-2')}>
      <div
        className={cn(
          'relative max-w-[min(82%,30rem)] rounded-xl px-2.5 pt-1.5 pb-1 text-sm leading-relaxed shadow-[0_1px_0.5px_rgb(0_0_0/0.13)]',
          outbound
            ? 'bg-wa-bubble-out text-wa-bubble-out-foreground'
            : 'bg-wa-bubble-in text-foreground',
          startsRun && (outbound ? 'rounded-tr-none' : 'rounded-tl-none')
        )}
      >
        {startsRun && (
          <span
            aria-hidden
            className={cn(
              'absolute top-0 size-2',
              outbound
                ? 'bg-wa-bubble-out -right-2 [clip-path:polygon(0_0,100%_0,0_100%)]'
                : 'bg-wa-bubble-in -left-2 [clip-path:polygon(0_0,100%_0,100%_100%)]'
            )}
          />
        )}
        {origin && <p className="text-wa-accent mb-0.5 text-[11px] font-semibold">{origin}</p>}
        <p className="break-words whitespace-pre-wrap">
          {message.body}
          {/* Reserves room so the floating timestamp never overlaps the last line. */}
          <span aria-hidden className="inline-block w-16" />
        </p>
        <span className="absolute right-2 bottom-1 flex items-center gap-1 text-[10px] tabular-nums opacity-70">
          {formatTime(message.timestamp)}
          {outbound && <StatusTicks status={message.status} />}
        </span>
      </div>
    </div>
  );
}

export function WhatsAppInbox({ number }: { number: WhatsAppNumber }) {
  const scopeKey = useClientScopeKey();
  const {
    data: conversations = [],
    error,
    isLoading,
    mutate: mutateList,
  } = useSWR<WhatsAppConversationItem[]>(
    [`${WHATSAPP_API_ROUTE}/conversations`, scopeKey],
    ([url]) => fetcher(url),
    {
      refreshInterval: 15_000,
    }
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const unreadTotal = conversations.reduce((sum, item) => sum + item.unreadCount, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((item) => {
      if (filter === 'unread' && item.unreadCount === 0) return false;
      if (filter === 'open' && !item.withinWindow) return false;
      if (!q) return true;
      return (
        item.waId.includes(q) ||
        (item.contactName?.toLowerCase().includes(q) ?? false) ||
        (item.lastPreview?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [conversations, search, filter]);

  useEffect(() => {
    if (!selectedId && filtered[0]) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const detailKey = selectedId
    ? ([`${WHATSAPP_API_ROUTE}/conversations/${selectedId}`, scopeKey] as const)
    : null;
  const {
    data: detail,
    mutate: mutateDetail,
    isLoading: detailLoading,
  } = useSWR<WhatsAppConversationDetail>(detailKey, ([url]) => fetcher(url), {
    refreshInterval: 8_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [detail?.messages.length, selectedId]);

  function openChat(id: string) {
    setSelectedId(id);
    setShowChatOnMobile(true);
    setSendError(null);
  }

  function resizeComposer() {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }

  async function reply() {
    if (!detail || !draft.trim() || sending) {
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
      requestAnimationFrame(resizeComposer);
      await Promise.all([mutateDetail(), mutateList()]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send');
    } finally {
      setSending(false);
    }
  }

  const remaining = detail ? windowRemaining(detail.conversation.lastInboundAt) : null;

  return (
    <section className="border-border bg-surface overflow-hidden rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="bg-wa-accent text-wa-accent-foreground flex size-9 items-center justify-center rounded-xl shadow-sm">
            <MessageCircle className="size-4" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Inbox
              <span className="text-wa-accent flex items-center gap-1 text-[11px] font-medium">
                <span className="relative flex size-2">
                  <span className="bg-wa-accent absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                  <span className="bg-wa-accent relative inline-flex size-2 rounded-full" />
                </span>
                Live
              </span>
            </h2>
            <p className="text-muted-foreground text-xs">
              {number.displayPhoneNumber} · {number.verifiedName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold tabular-nums">
          {unreadTotal > 0 && (
            <span className="bg-wa-accent text-wa-accent-foreground rounded-full px-2.5 py-1">
              {unreadTotal} unread
            </span>
          )}
          <span className="bg-surface-muted text-muted-foreground rounded-full px-2.5 py-1">
            {conversations.length} chat{conversations.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="grid h-[640px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={cn(
            'border-border min-h-0 flex-col lg:flex lg:border-r',
            showChatOnMobile ? 'hidden' : 'flex'
          )}
        >
          <div className="space-y-2.5 p-3">
            <label className="bg-surface-muted/70 focus-within:ring-wa-accent/40 flex h-9 items-center gap-2 rounded-lg px-3 transition focus-within:ring-2">
              <Search className="text-muted-foreground size-3.5 shrink-0" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search or start a new chat"
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <div role="tablist" aria-label="Filter chats" className="flex gap-1.5">
              {CHAT_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    filter === option.value
                      ? 'bg-wa-accent/15 text-wa-accent'
                      : 'bg-surface-muted/70 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <ul className="space-y-1 px-2" aria-label="Loading chats">
                {Array.from({ length: 6 }, (_, index) => (
                  <li key={index} className="flex animate-pulse items-center gap-3 px-2.5 py-3">
                    <span className="bg-surface-muted size-11 rounded-full" />
                    <span className="flex-1 space-y-2">
                      <span className="bg-surface-muted block h-3 w-2/5 rounded" />
                      <span className="bg-surface-muted block h-2.5 w-4/5 rounded" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="text-danger px-4 py-6 text-sm">{error.message}</p>}
            {!isLoading && !error && filtered.length === 0 && (
              <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-14 text-center text-sm">
                <MessageCircle className="size-8 opacity-40" />
                <p className="text-foreground font-medium">
                  {conversations.length === 0 ? 'No chats yet' : 'No chats match'}
                </p>
                <p className="text-xs leading-relaxed">
                  {conversations.length === 0
                    ? 'When a customer messages your number, the chat shows up here.'
                    : 'Try a different search or filter.'}
                </p>
              </div>
            )}
            <ul>
              {filtered.map((item) => {
                const active = item.id === selectedId;
                const unread = item.unreadCount > 0;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openChat(item.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition',
                        active ? 'bg-surface-muted' : 'hover:bg-surface-muted/60'
                      )}
                    >
                      <Avatar name={item.contactName} waId={item.waId} />
                      <span className="border-border min-w-0 flex-1 border-b pb-2.5">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                            {item.contactName || `+${item.waId}`}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 text-[11px] tabular-nums',
                              unread ? 'text-wa-accent font-semibold' : 'text-muted-foreground'
                            )}
                          >
                            {formatWhen(item.lastMessageAt)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[13px]',
                              unread ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {item.lastPreview || '—'}
                          </span>
                          {unread ? (
                            <span className="bg-wa-accent text-wa-accent-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
                              {item.unreadCount > 99 ? '99+' : item.unreadCount}
                            </span>
                          ) : (
                            item.withinWindow && (
                              <span
                                className="bg-wa-accent size-2 shrink-0 rounded-full"
                                title="24h window open"
                              />
                            )
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

        <section
          className={cn('min-h-0 flex-col lg:flex', showChatOnMobile ? 'flex' : 'hidden')}
          aria-label="Conversation"
        >
          {!selectedId ? (
            <div
              className="bg-wa-wallpaper text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm"
              style={WALLPAPER_STYLE}
            >
              <span className="bg-surface flex size-16 items-center justify-center rounded-full shadow-sm">
                <MessageCircle className="text-wa-accent size-7" />
              </span>
              <p className="text-foreground font-medium">Pick a chat to start replying</p>
              <p className="flex items-center gap-1 text-xs">
                <Lock className="size-3" /> Messages go out from {number.displayPhoneNumber}
              </p>
            </div>
          ) : detailLoading && !detail ? (
            <div
              className="bg-wa-wallpaper text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm"
              style={WALLPAPER_STYLE}
            >
              Loading messages…
            </div>
          ) : detail ? (
            <>
              <header className="border-border bg-surface flex items-center gap-3 border-b px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setShowChatOnMobile(false)}
                  className="text-muted-foreground hover:text-foreground -ml-1 rounded-full p-1.5 lg:hidden"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <Avatar
                  name={detail.conversation.contactName}
                  waId={detail.conversation.waId}
                  size="sm"
                />
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
                    'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    remaining ? 'bg-wa-accent/15 text-wa-accent' : 'bg-amber-500/15 text-amber-600'
                  )}
                  title="WhatsApp only allows free-form replies within 24h of the customer's last message"
                >
                  <Clock className="size-3" />
                  {remaining ?? 'Window closed'}
                </span>
              </header>

              <div
                className="bg-wa-wallpaper min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-8"
                style={WALLPAPER_STYLE}
              >
                <p className="text-muted-foreground bg-surface/90 mx-auto mb-3 flex w-fit max-w-sm items-center gap-1.5 rounded-lg px-3 py-1.5 text-center text-[11px] shadow-sm">
                  <Lock className="size-3 shrink-0" />
                  Replies here are sent from {number.displayPhoneNumber}
                </p>
                {detail.messages.length === 0 && (
                  <p className="text-muted-foreground py-10 text-center text-sm">
                    No messages in this chat.
                  </p>
                )}
                {detail.messages.map((message, index) => {
                  const previous = detail.messages[index - 1];
                  const newDay =
                    !previous ||
                    !isSameDay(new Date(previous.timestamp), new Date(message.timestamp));
                  const startsRun = newDay || previous.direction !== message.direction;
                  return (
                    <Fragment key={message.id}>
                      {newDay && (
                        <div className="my-3 flex justify-center">
                          <span className="bg-surface/90 text-muted-foreground rounded-lg px-3 py-1 text-[11px] font-medium shadow-sm">
                            {dayLabel(message.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className={startsRun ? undefined : 'mt-0.5'}>
                        <MessageBubble message={message} startsRun={startsRun} />
                      </div>
                    </Fragment>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <footer className="border-border bg-surface border-t px-3 py-2.5">
                {!remaining && (
                  <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                    The 24h window is closed, so a free-form reply will likely fail. Send an
                    approved template from Compose below instead.
                  </p>
                )}
                {sendError && (
                  <p
                    className="text-danger bg-danger/10 mb-2 rounded-lg px-3 py-2 text-xs"
                    role="alert"
                  >
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
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      resizeComposer();
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        void reply();
                      }
                    }}
                    rows={1}
                    aria-label="Reply"
                    placeholder={remaining ? 'Type a message' : 'Window closed: prefer a template'}
                    className="bg-surface-muted/70 placeholder:text-muted-foreground focus:ring-wa-accent/40 max-h-[140px] min-h-[42px] min-w-0 flex-1 resize-none rounded-3xl px-4 py-2.5 text-sm outline-none focus:ring-2"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    title="Send (Enter)"
                    className="bg-wa-accent text-wa-accent-foreground flex size-[42px] shrink-0 items-center justify-center rounded-full shadow-sm transition hover:brightness-110 disabled:opacity-40"
                  >
                    <SendHorizontal className="size-[18px]" />
                    <span className="sr-only">{sending ? 'Sending' : 'Send'}</span>
                  </button>
                </form>
                <p className="text-muted-foreground mt-1.5 hidden px-1 text-[10px] sm:block">
                  Enter to send · Shift + Enter for a new line
                </p>
              </footer>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
