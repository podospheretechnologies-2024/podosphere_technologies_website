'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { CALENDAR_VIEW_LABELS, CALENDAR_VIEWS, type CalendarView } from '../../config/calendar';
import { useChannels } from '../../hooks/use-channels';
import { useCalendarPosts } from '../../hooks/use-posts';
import {
  daysInRange,
  formatRangeLabel,
  getCalendarRange,
  shiftCursor,
  type DraggedPost,
} from '../../lib/calendar';
import { reschedulePost, revalidatePosts, deletePostGroup, toDateTimeLocal } from '../../lib/posts.client';
import type { PostListItem } from '../../types/post';
import { ChannelAvatar } from '../channels/channel-avatar';
import { ProviderMark } from '../channels/provider-mark';
import { PostComposer } from '../posts/composer/post-composer';
import { PostsList } from '../posts/posts-list';
import { SuccessToast } from '../shell/success-toast';
import { MonthView } from './month-view';
import { TimeGridView } from './time-grid-view';

const STATE_LEGEND = [
  { label: 'Scheduled', className: 'bg-primary' },
  { label: 'Published', className: 'bg-success' },
  { label: 'Failed', className: 'bg-danger' },
  { label: 'Draft', className: 'bg-muted-foreground' },
];

type ComposerState = { open: false } | { open: true; group: string | null; defaultDate?: string };

export function SocialCalendar() {
  const [view, setView] = useState<CalendarView>('week');
  const [cursor, setCursor] = useState<Dayjs>(() => dayjs());
  const [composer, setComposer] = useState<ComposerState>({ open: false });
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [channelQuery, setChannelQuery] = useState('');
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const channelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!channelMenuOpen) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (
        channelPickerRef.current &&
        !channelPickerRef.current.contains(event.target as Node)
      ) {
        setChannelMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [channelMenuOpen]);

  const range = getCalendarRange(view, cursor);
  const { data: posts, error, isLoading } = useCalendarPosts(view === 'list' ? null : range);
  const { data: channelsData } = useChannels();
  const channels = channelsData?.channels ?? [];

  const channelOptions = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    if (!q) {
      return channels;
    }
    return channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(q) ||
        (channel.username?.toLowerCase().includes(q) ?? false) ||
        channel.providerName.toLowerCase().includes(q)
    );
  }, [channels, channelQuery]);

  const selectedChannel =
    channelFilter === 'all' ? null : channels.find((channel) => channel.id === channelFilter);

  const visiblePosts = useMemo(() => {
    const all = posts ?? [];
    if (channelFilter === 'all') {
      return all;
    }
    return all.filter((post) => post.channel.id === channelFilter);
  }, [posts, channelFilter]);

  const channelPostStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of visiblePosts) {
      counts.set(post.channel.id, (counts.get(post.channel.id) ?? 0) + 1);
    }

    const source =
      channelFilter === 'all'
        ? channels
        : channels.filter((channel) => channel.id === channelFilter);

    if (source.length > 0) {
      return source
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          picture: channel.picture,
          providerIdentifier: channel.providerIdentifier,
          providerName: channel.providerName,
          count: counts.get(channel.id) ?? 0,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }

    const byId = new Map<string, PostListItem['channel']>();
    for (const post of visiblePosts) {
      byId.set(post.channel.id, post.channel);
    }
    return [...byId.values()]
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        picture: channel.picture,
        providerIdentifier: channel.providerIdentifier,
        providerName: channel.providerName,
        count: counts.get(channel.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [visiblePosts, channels, channelFilter]);

  function pickChannel(id: string, label: string) {
    setChannelFilter(id);
    setChannelQuery(id === 'all' ? '' : label);
    setChannelMenuOpen(false);
  }

  function openPost(post: PostListItem) {
    if (post.state === 'published') {
      if (post.releaseUrl) {
        window.open(post.releaseUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    setComposer({ open: true, group: post.group });
  }

  function createAt(date: Dayjs) {
    setComposer({ open: true, group: null, defaultDate: toDateTimeLocal(date.toDate()) });
  }

  async function movePost(post: DraggedPost, date: Dayjs) {
    if (date.isSame(dayjs(post.publishDate))) {
      return;
    }
    if (date.isBefore(dayjs())) {
      setActionError('Posts can only be moved to a future time.');
      return;
    }

    setActionError(null);
    try {
      await reschedulePost(post.group, date.toDate());
      await revalidatePosts();
    } catch (moveError) {
      setActionError(moveError instanceof Error ? moveError.message : 'Could not move the post');
    }
  }

  async function deletePost(post: PostListItem) {
    if (!window.confirm(`Delete this post for ${post.channel.name}?`)) {
      return;
    }
    setActionError(null);
    try {
      await deletePostGroup(post.group);
      await revalidatePosts();
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the post'
      );
    }
  }

  function showDay(day: Dayjs) {
    setCursor(day);
    setView('day');
  }

  const gridProps = {
    posts: visiblePosts,
    onOpen: openPost,
    onDelete: deletePost,
    onMove: movePost,
    onCreate: createAt,
  };

  return (
    <div className="space-y-4">
      {toast && <SuccessToast message={toast} />}

      <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-2">
        <div
          role="tablist"
          aria-label="Calendar view"
          className="bg-surface-muted flex gap-1 rounded-lg p-1"
        >
          {CALENDAR_VIEWS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition',
                view === value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {CALENDAR_VIEW_LABELS[value]}
            </button>
          ))}
        </div>

        {view !== 'list' && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCursor(dayjs())}>
              Today
            </Button>
            <div className="border-border flex items-center overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => setCursor(shiftCursor(view, cursor, -1))}
                aria-label="Previous"
                className="text-muted-foreground hover:bg-surface-muted hover:text-foreground p-1.5 transition"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursor(shiftCursor(view, cursor, 1))}
                aria-label="Next"
                className="border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground border-l p-1.5 transition"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <h2 className="ml-1 text-base font-semibold" aria-live="polite">
              {formatRangeLabel(view, cursor)}
            </h2>
            {isLoading && <span className="text-muted-foreground ml-2 text-xs">Loading…</span>}
          </div>
        )}

        {view !== 'list' && (
          <div className="relative w-full min-w-[240px] sm:w-[280px] sm:flex-none" ref={channelPickerRef}>
            <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase">
              Channel
            </p>
            <label className="border-primary/40 bg-surface focus-within:border-primary focus-within:ring-primary/30 flex h-10 items-center gap-2 rounded-lg border-2 px-3 shadow-sm transition focus-within:ring-2">
              <Search className="text-primary size-4 shrink-0" />
              <input
                type="search"
                value={
                  channelMenuOpen
                    ? channelQuery
                    : channelFilter === 'all'
                      ? 'All'
                      : (selectedChannel?.name ?? channelQuery)
                }
                onChange={(event) => {
                  setChannelQuery(event.target.value);
                  setChannelMenuOpen(true);
                }}
                onFocus={() => {
                  setChannelMenuOpen(true);
                  if (channelFilter === 'all') {
                    setChannelQuery('');
                  } else if (!channelQuery) {
                    setChannelQuery(selectedChannel?.name ?? '');
                  }
                }}
                placeholder="Search channel…"
                aria-label="Filter calendar by channel"
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
              />
            </label>
            {channelMenuOpen && (
              <ul className="border-border bg-surface absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border py-1 shadow-lg">
                <li>
                  <button
                    type="button"
                    onClick={() => pickChannel('all', '')}
                    className={cn(
                      'hover:bg-surface-muted flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
                      channelFilter === 'all' && 'bg-primary/10 text-primary font-semibold'
                    )}
                  >
                    All
                  </button>
                </li>
                {channelOptions.map((channel) => (
                  <li key={channel.id}>
                    <button
                      type="button"
                      onClick={() => pickChannel(channel.id, channel.name)}
                      className={cn(
                        'hover:bg-surface-muted flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm',
                        channelFilter === channel.id && 'bg-primary/10 text-primary font-semibold'
                      )}
                    >
                      <span className="relative shrink-0">
                        <ChannelAvatar name={channel.name} picture={channel.picture} size="xs" />
                        <ProviderMark
                          identifier={channel.providerIdentifier}
                          name={channel.providerName}
                          size="sm"
                          className="ring-surface absolute -right-0.5 -bottom-0.5 size-3 ring-1"
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {channel.providerName}
                      </span>
                    </button>
                  </li>
                ))}
                {channelOptions.length === 0 && (
                  <li className="text-muted-foreground px-3 py-2 text-sm">No channels match.</li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="text-muted-foreground hidden items-center gap-3 text-xs lg:flex">
            {STATE_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={cn('size-2 rounded-full', item.className)} />
                {item.label}
              </span>
            ))}
          </div>
          <Button onClick={() => setComposer({ open: true, group: null })}>
            <Plus className="size-4" />
            Create post
          </Button>
        </div>
      </div>

      {(actionError || (error && view !== 'list')) && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {actionError ?? (error instanceof Error ? error.message : 'Could not load posts')}
        </div>
      )}

      {view !== 'list' && channelPostStats.length > 0 && (
        <div className="border-border bg-surface rounded-xl border p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Posts by channel</h3>
            <p className="text-muted-foreground text-xs">
              In this {view}: {visiblePosts.length} post{visiblePosts.length === 1 ? '' : 's'}
            </p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {channelPostStats.map((channel) => (
              <li
                key={channel.id}
                className="border-border bg-surface-muted/40 flex min-w-[160px] max-w-full items-center gap-2 rounded-lg border px-2.5 py-2"
                title={`${channel.name} · ${channel.providerName}`}
              >
                <span className="relative shrink-0">
                  <ChannelAvatar name={channel.name} picture={channel.picture} size="sm" />
                  <ProviderMark
                    identifier={channel.providerIdentifier}
                    name={channel.providerName}
                    size="sm"
                    className="ring-surface absolute -right-1 -bottom-1 size-3.5 ring-1"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{channel.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {channel.providerName}
                  </span>
                </span>
                <span className="bg-primary/15 text-primary shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {channel.count} post{channel.count === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === 'list' ? (
        <PostsList onEdit={(group) => setComposer({ open: true, group })} />
      ) : view === 'month' ? (
        <MonthView month={cursor} days={daysInRange(range)} onShowDay={showDay} {...gridProps} />
      ) : (
        <TimeGridView days={daysInRange(range)} {...gridProps} />
      )}

      <PostComposer
        open={composer.open}
        group={composer.open ? composer.group : null}
        defaultDate={composer.open ? composer.defaultDate : undefined}
        onClose={() => setComposer({ open: false })}
        onSaved={() => {
          setComposer({ open: false });
          setToast('Added successfully');
          void revalidatePosts();
        }}
      />
    </div>
  );
}
