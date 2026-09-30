'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { groupPosts, moveToSlot, slotKey, type DraggedPost } from '../../lib/calendar';
import type { PostListItem } from '../../types/post';
import { CalendarDropZone } from './calendar-drop-zone';
import { CalendarPostChip } from './calendar-post-chip';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** Matches the min-h-16 slot height. */
const HOUR_ROW_HEIGHT = 64;
const INITIAL_SCROLL_HOUR = 8;
const CLOCK_TICK_MS = 60 * 1000;

interface TimeGridViewProps {
  days: Dayjs[];
  posts: PostListItem[];
  onOpen: (post: PostListItem) => void;
  onDelete?: (post: PostListItem) => void;
  onMove: (post: DraggedPost, date: Dayjs) => void;
  onCreate: (date: Dayjs) => void;
}

// Day and week views: one column per day, one row per hour.
export function TimeGridView({ days, posts, onOpen, onDelete, onMove, onCreate }: TimeGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const postsBySlot = groupPosts(posts, slotKey);
  const now = dayjs();
  const columns = { gridTemplateColumns: `4.5rem repeat(${days.length}, minmax(0, 1fr))` };

  // Client-only clock for the current-time line; rendering it on the server would
  // cause a hydration mismatch whenever the minute changes before the page loads.
  const [clock, setClock] = useState<Dayjs | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR_ROW_HEIGHT * INITIAL_SCROLL_HOUR });
  }, []);

  useEffect(() => {
    const tick = () => setClock(dayjs());
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, CLOCK_TICK_MS);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-sm">
      <div className="border-border bg-surface grid border-b" style={columns}>
        <div className="text-muted-foreground flex items-end justify-end px-3 pb-2 text-[10px] font-medium uppercase">
          {now.format('[GMT]Z')}
        </div>
        {days.map((day) => {
          const isToday = day.isSame(now, 'day');
          return (
            <div
              key={day.valueOf()}
              className={cn(
                'border-border flex flex-col items-center gap-1 border-l py-3',
                isToday && 'bg-primary/5'
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-semibold tracking-wider uppercase',
                  isToday ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {day.format('ddd')}
              </span>
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-lg font-semibold tabular-nums',
                  isToday && 'bg-primary text-primary-foreground shadow-sm'
                )}
              >
                {day.date()}
              </span>
              <span className="text-muted-foreground text-[11px]">{day.format('MMM')}</span>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="max-h-[65vh] overflow-y-auto">
        {HOURS.map((hour) => (
          <div key={hour} className="border-border grid border-b last:border-b-0" style={columns}>
            <div className="text-muted-foreground relative pr-3 text-right text-[11px] font-medium tabular-nums">
              {hour > 0 && (
                <span className="bg-surface absolute right-3 -translate-y-1/2 px-1">
                  {dayjs().hour(hour).minute(0).format('h A')}
                </span>
              )}
            </div>
            {days.map((day) => {
              const slotStart = day.hour(hour);
              const slotPosts = postsBySlot.get(slotKey(slotStart)) ?? [];
              const isToday = day.isSame(now, 'day');
              const disabled = slotStart.add(1, 'hour').isBefore(now);
              const isCurrentHour =
                clock !== null && day.isSame(clock, 'day') && clock.hour() === hour;
              return (
                <CalendarDropZone
                  key={day.valueOf()}
                  label={slotStart.format('dddd D MMMM, HH:mm')}
                  disabled={disabled}
                  onDropPost={(post) => onMove(post, moveToSlot(post.publishDate, day, hour))}
                  onCreate={() => onCreate(slotStart.isBefore(now) ? now : slotStart)}
                  className={cn(
                    'border-border relative flex min-h-16 flex-col gap-1 border-l p-1',
                    isToday && !disabled && 'bg-primary/[0.03]'
                  )}
                >
                  {isCurrentHour && (
                    <span
                      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                      style={{ top: `${(clock.minute() / 60) * 100}%` }}
                    >
                      <span className="bg-danger -ml-1 size-2 rounded-full" />
                      <span className="bg-danger h-0.5 flex-1" />
                    </span>
                  )}
                  {slotPosts.map((post) => (
                    <CalendarPostChip
                      key={post.id}
                      post={post}
                      onOpen={onOpen}
                      onDelete={onDelete}
                    />
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
