import dayjs, { type Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { CalendarView } from '../config/calendar';
import type { PostListItem } from '../types/post';

dayjs.extend(isoWeek);

/** dataTransfer type used when dragging a post between calendar slots. */
export const POST_DRAG_TYPE = 'application/x-social-post';

export interface DraggedPost {
  group: string;
  publishDate: string;
}

/** End is exclusive. */
export interface CalendarRange {
  start: Dayjs;
  end: Dayjs;
}

export function getCalendarRange(view: CalendarView, cursor: Dayjs): CalendarRange {
  if (view === 'day') {
    const start = cursor.startOf('day');
    return { start, end: start.add(1, 'day') };
  }
  if (view === 'week') {
    const start = cursor.startOf('isoWeek');
    return { start, end: start.add(7, 'day') };
  }
  // The month grid always shows 6 full weeks, starting on the Monday before the 1st.
  const start = cursor.startOf('month').startOf('isoWeek');
  return { start, end: start.add(42, 'day') };
}

export function shiftCursor(view: CalendarView, cursor: Dayjs, direction: 1 | -1): Dayjs {
  const unit = view === 'day' ? 'day' : view === 'week' ? 'week' : 'month';
  return cursor.add(direction, unit);
}

export function formatRangeLabel(view: CalendarView, cursor: Dayjs): string {
  if (view === 'day') {
    return cursor.format('dddd, D MMMM YYYY');
  }
  if (view === 'week') {
    const start = cursor.startOf('isoWeek');
    const end = start.add(6, 'day');
    return start.isSame(end, 'month')
      ? `${start.format('D')} – ${end.format('D MMMM YYYY')}`
      : `${start.format('D MMM')} – ${end.format('D MMM YYYY')}`;
  }
  return cursor.format('MMMM YYYY');
}

export function daysInRange({ start, end }: CalendarRange): Dayjs[] {
  const days: Dayjs[] = [];
  for (let day = start; day.isBefore(end); day = day.add(1, 'day')) {
    days.push(day);
  }
  return days;
}

export function dayKey(date: Dayjs | string): string {
  return dayjs(date).format('YYYY-MM-DD');
}

export function slotKey(date: Dayjs | string): string {
  return dayjs(date).format('YYYY-MM-DD-HH');
}

export function groupPosts(
  posts: PostListItem[],
  keyOf: (date: string) => string
): Map<string, PostListItem[]> {
  const grouped = new Map<string, PostListItem[]>();
  for (const post of posts) {
    const key = keyOf(post.publishDate);
    grouped.set(key, [...(grouped.get(key) ?? []), post]);
  }
  return grouped;
}

/** Moves a post to another day (and optionally hour) while keeping its minutes. */
export function moveToSlot(publishDate: string, day: Dayjs, hour?: number): Dayjs {
  const original = dayjs(publishDate);
  return day
    .hour(hour ?? original.hour())
    .minute(original.minute())
    .second(0)
    .millisecond(0);
}

export function readDraggedPost(dataTransfer: DataTransfer): DraggedPost | null {
  try {
    const parsed = JSON.parse(dataTransfer.getData(POST_DRAG_TYPE)) as Partial<DraggedPost>;
    return parsed.group && parsed.publishDate
      ? { group: parsed.group, publishDate: parsed.publishDate }
      : null;
  } catch {
    return null;
  }
}
