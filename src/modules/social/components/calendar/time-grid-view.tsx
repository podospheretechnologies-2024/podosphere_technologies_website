'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/cn';
import { groupPosts, moveToSlot, slotKey, type DraggedPost } from '../../lib/calendar';
import type { PostListItem } from '../../types/post';
import { CalendarDropZone } from './calendar-drop-zone';
import { CalendarPostChip } from './calendar-post-chip';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** Matches the min-h-16 slot height. */
const HOUR_ROW_HEIGHT = 64;
const INITIAL_SCROLL_HOUR = 8;

interface TimeGridViewProps {
  days: Dayjs[];
  posts: PostListItem[];
  onOpen: (post: PostListItem) => void;
  onMove: (post: DraggedPost, date: Dayjs) => void;
  onCreate: (date: Dayjs) => void;
}

// Day and week views: one column per day, one row per hour.
export function TimeGridView({ days, posts, onOpen, onMove, onCreate }: TimeGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const postsBySlot = groupPosts(posts, slotKey);
  const now = dayjs();
  const columns = { gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR_ROW_HEIGHT * INITIAL_SCROLL_HOUR });
  }, []);

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border">
      <div className="border-border grid border-b" style={columns}>
        <div />
        {days.map((day) => (
          <div
            key={day.valueOf()}
            className={cn(
              'border-border border-l px-2 py-2 text-center text-sm',
              day.isSame(now, 'day') && 'text-primary font-semibold'
            )}
          >
            <span className="text-muted-foreground block text-xs uppercase">
              {day.format('ddd')}
            </span>
            {day.format('D MMM')}
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="max-h-[65vh] overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="border-border grid border-b last:border-b-0" style={columns}>
            <div className="text-muted-foreground px-2 pt-1 text-right text-xs tabular-nums">
              {String(hour).padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const slotStart = day.hour(hour);
              const slotPosts = postsBySlot.get(slotKey(slotStart)) ?? [];
              return (
                <CalendarDropZone
                  key={day.valueOf()}
                  label={slotStart.format('dddd D MMMM, HH:mm')}
                  disabled={slotStart.add(1, 'hour').isBefore(now)}
                  onDropPost={(post) => onMove(post, moveToSlot(post.publishDate, day, hour))}
                  onCreate={() => onCreate(slotStart.isBefore(now) ? now : slotStart)}
                  className="border-border flex min-h-16 flex-col gap-1 border-l p-1"
                >
                  {slotPosts.map((post) => (
                    <CalendarPostChip key={post.id} post={post} onOpen={onOpen} />
                  ))}
                </CalendarDropZone>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
