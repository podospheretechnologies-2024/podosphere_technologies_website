export const CALENDAR_VIEWS = ['day', 'week', 'month', 'list'] as const;

export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const CALENDAR_VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  list: 'List',
};

/** The month grid spans 6 weeks, so the API allows a little more than that. */
export const CALENDAR_MAX_RANGE_DAYS = 45;

/** Posts shown in a month cell before collapsing into "+N more". */
export const MONTH_CELL_MAX_POSTS = 3;
