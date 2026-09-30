'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { cn } from '@/shared/lib/cn';
import { MONTH_CELL_MAX_POSTS } from '../../config/calendar';
import { dayKey, groupPosts, moveToSlot, type DraggedPost } from '../../lib/calendar';
import type { PostListItem } from '../../types/post';
import { CalendarDropZone } from './calendar-drop-zone';
import { CalendarPostChip } from './calendar-post-chip';

const DEFAULT_POST_HOUR = 9;

interface MonthViewProps {
  month: Dayjs;
  days: Dayjs[];
  posts: PostListItem[];
  onOpen: (post: PostListItem) => void;
  onDelete?: (post: PostListItem) => void;
  onMove: (post: DraggedPost, date: Dayjs) => void;
  onCreate: (date: Dayjs) => void;
  onShowDay: (day: Dayjs) => void;
}

export function MonthView({
  month,
  days,
  posts,
  onOpen,
  onDelete,
  onMove,
  onCreate,
  onShowDay,
}: MonthViewProps) {
  const postsByDay = groupPosts(posts, dayKey);
  const now = dayjs();

  function defaultSlot(day: Dayjs): Dayjs {
    const slot = day.hour(DEFAULT_POST_HOUR).minute(0);
    return slot.isBefore(now) ? now.add(1, 'hour').startOf('hour') : slot;
  }

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
      <div className="border-border grid grid-cols-7 border-b">
        {days.slice(0, 7).map((day) => (
          <div
            key={day.valueOf()}
            className="text-muted-foreground px-3 py-2.5 text-center text-xs font-medium"
          >
            {day.format('dddd')}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayPosts = postsByDay.get(dayKey(day)) ?? [];
          const hidden = dayPosts.length - MONTH_CELL_MAX_POSTS;
          const isToday = day.isSame(now, 'day');
          const disabled = day.endOf('day').isBefore(now);
          const outsideMonth = !day.isSame(month, 'month');
          return (
            <CalendarDropZone
              key={day.valueOf()}
              label={day.format('dddd D MMMM')}
              disabled={disabled}
              onDropPost={(post) => onMove(post, moveToSlot(post.publishDate, day))}
              onCreate={() => onCreate(defaultSlot(day))}
              className={cn(
                'border-border group/cell relative flex min-h-36 flex-col gap-1.5 border-r border-b p-2 [&:nth-child(7n)]:border-r-0',
                outsideMonth &&
                  'bg-[repeating-linear-gradient(-45deg,transparent,transparent_6px,rgba(255,255,255,0.03)_6px,rgba(255,255,255,0.03)_7px)] opacity-50',
                isToday && 'bg-primary/5',
                !disabled && 'hover:ring-primary/50 hover:ring-1 hover:ring-inset'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none mb-0.5 text-center text-sm tabular-nums',
                  isToday ? 'text-primary font-semibold' : 'text-muted-foreground font-medium'
                )}
              >
                {day.date()}
              </span>
              {dayPosts.slice(0, MONTH_CELL_MAX_POSTS).map((post) => (
                <CalendarPostChip
                  key={post.id}
                  post={post}
                  onOpen={onOpen}
                  onDelete={onDelete}
                />
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => onShowDay(day)}
                  className="text-muted-foreground hover:text-foreground px-1 text-left text-xs"
                >
                  Show more ({hidden})
                </button>
              )}
            </CalendarDropZone>
          );
        })}
      </div>
    </div>
  );
}
