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
  onMove: (post: DraggedPost, date: Dayjs) => void;
  onCreate: (date: Dayjs) => void;
  onShowDay: (day: Dayjs) => void;
}

export function MonthView({
  month,
  days,
  posts,
  onOpen,
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
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="border-border grid grid-cols-7 border-b">
        {days.slice(0, 7).map((day) => (
          <div
            key={day.valueOf()}
            className="text-muted-foreground px-2 py-2 text-center text-xs font-medium uppercase"
          >
            {day.format('ddd')}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayPosts = postsByDay.get(dayKey(day)) ?? [];
          const hidden = dayPosts.length - MONTH_CELL_MAX_POSTS;
          return (
            <CalendarDropZone
              key={day.valueOf()}
              label={day.format('dddd D MMMM')}
              disabled={day.endOf('day').isBefore(now)}
              onDropPost={(post) => onMove(post, moveToSlot(post.publishDate, day))}
              onCreate={() => onCreate(defaultSlot(day))}
              className={cn(
                'border-border flex min-h-28 flex-col gap-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0',
                !day.isSame(month, 'month') && 'opacity-50'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none flex size-6 items-center justify-center rounded-full text-xs',
                  day.isSame(now, 'day') && 'bg-primary text-primary-foreground font-semibold'
                )}
              >
                {day.date()}
              </span>
              {dayPosts.slice(0, MONTH_CELL_MAX_POSTS).map((post) => (
                <CalendarPostChip key={post.id} post={post} onOpen={onOpen} />
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => onShowDay(day)}
                  className="text-primary px-1 text-left text-xs font-medium hover:underline"
                >
                  +{hidden} more
                </button>
              )}
            </CalendarDropZone>
          );
        })}
      </div>
    </div>
  );
}
