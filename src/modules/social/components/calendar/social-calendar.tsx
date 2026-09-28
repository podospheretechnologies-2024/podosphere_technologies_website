'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { CALENDAR_VIEW_LABELS, CALENDAR_VIEWS, type CalendarView } from '../../config/calendar';
import { useCalendarPosts } from '../../hooks/use-posts';
import {
  daysInRange,
  formatRangeLabel,
  getCalendarRange,
  shiftCursor,
  type DraggedPost,
} from '../../lib/calendar';
import { reschedulePost, revalidatePosts, toDateTimeLocal } from '../../lib/posts.client';
import type { PostListItem } from '../../types/post';
import { PostComposer } from '../posts/composer/post-composer';
import { PostsList } from '../posts/posts-list';
import { MonthView } from './month-view';
import { TimeGridView } from './time-grid-view';

type ComposerState = { open: false } | { open: true; group: string | null; defaultDate?: string };

export function SocialCalendar() {
  const [view, setView] = useState<CalendarView>('week');
  const [cursor, setCursor] = useState<Dayjs>(() => dayjs());
  const [composer, setComposer] = useState<ComposerState>({ open: false });
  const [actionError, setActionError] = useState<string | null>(null);

  const range = getCalendarRange(view, cursor);
  const { data: posts, error, isLoading } = useCalendarPosts(view === 'list' ? null : range);

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

  function showDay(day: Dayjs) {
    setCursor(day);
    setView('day');
  }

  const gridProps = {
    posts: posts ?? [],
    onOpen: openPost,
    onMove: movePost,
    onCreate: createAt,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Calendar view" className="flex gap-1">
          {CALENDAR_VIEWS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                view === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              )}
            >
              {CALENDAR_VIEW_LABELS[value]}
            </button>
          ))}
        </div>

        {view !== 'list' && (
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => setCursor(dayjs())}>
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(shiftCursor(view, cursor, -1))}
              aria-label="Previous"
            >
              ‹
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCursor(shiftCursor(view, cursor, 1))}
              aria-label="Next"
            >
              ›
            </Button>
            <h2 className="ml-2 text-sm font-semibold" aria-live="polite">
              {formatRangeLabel(view, cursor)}
            </h2>
            {isLoading && <span className="text-muted-foreground ml-2 text-xs">Loading…</span>}
          </div>
        )}

        <Button className="ml-auto" onClick={() => setComposer({ open: true, group: null })}>
          Create post
        </Button>
      </div>

      {(actionError || (error && view !== 'list')) && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {actionError ?? (error instanceof Error ? error.message : 'Could not load posts')}
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
          void revalidatePosts();
        }}
      />
    </div>
  );
}
