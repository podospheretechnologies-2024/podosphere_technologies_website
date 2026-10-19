export const POSTS_PAGE_SIZE = 20;

/** Hard cap regardless of channel, so a single post cannot bloat the database. */
export const POST_CONTENT_MAX_LENGTH = 10_000;
export const POST_MAX_MEDIA = 10;
export const POST_MAX_THREAD_ITEMS = 25;

export const POST_LIST_FILTER_VALUES = ['all', 'scheduled', 'draft', 'published', 'error'] as const;

export type PostListFilter = (typeof POST_LIST_FILTER_VALUES)[number];

export const POST_LIST_FILTER_LABELS: Record<PostListFilter, string> = {
  all: 'Upcoming',
  scheduled: 'Scheduled',
  draft: 'Drafts',
  published: 'Published',
  error: 'Failed',
};

export const POST_SAVE_TYPES = ['draft', 'schedule', 'now'] as const;

export type PostSaveType = (typeof POST_SAVE_TYPES)[number];

/** Composer / API recurrence frequencies (F9). */
export const RECURRENCE_RULES = ['daily', 'weekly', 'monthly'] as const;

export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export const RECURRENCE_RULE_LABELS: Record<RecurrenceRule, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
};

/** Cap so a misconfigured loop cannot schedule forever in one request. */
export const RECURRENCE_MAX_RUNS_CAP = 365;

/** Evergreen clones stay at least this many days after the last publish. */
export const EVERGREEN_MIN_GAP_DAYS = 7;
