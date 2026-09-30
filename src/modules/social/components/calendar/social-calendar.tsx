'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { reschedulePost, revalidatePosts, deletePostGroup, toDateTimeLocal } from '../../lib/posts.client';
import type { PostListItem } from '../../types/post';
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

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    posts: posts ?? [],
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
