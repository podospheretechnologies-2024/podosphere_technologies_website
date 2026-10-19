/** Max data rows accepted in one CSV upload (excluding header). */
export const CSV_IMPORT_MAX_ROWS = 200;

/** Max CSV file size (1 MB of text is plenty for 200 caption rows). */
export const CSV_IMPORT_MAX_BYTES = 1_048_576;

/** Default wall-clock zone when the CSV has date + time without an offset. */
export const CSV_IMPORT_DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const CSV_DATE_HEADER_HINTS = [
  'date',
  'post date',
  'posting date',
  'scheduled',
  'schedule',
  'publish date',
  'day',
  'when',
] as const;

export const CSV_TIME_HEADER_HINTS = [
  'time',
  'hour',
  'publish time',
  'scheduled time',
  'post time',
  'posting time',
] as const;

export const CSV_CHANNEL_HEADER_HINTS = [
  'channels',
  'channel',
  'accounts',
  'account',
  'platforms',
  'platform',
  'integrations',
  'integration',
] as const;

export const CSV_TEXT_HEADER_HINTS = [
  'text',
  'content',
  'caption',
  'post',
  'message',
  'description',
  'body',
  'copy',
  'headline',
  'title',
] as const;

export const CSV_MEDIA_HEADER_HINTS = [
  'media url',
  'media urls',
  'media',
  'image url',
  'image urls',
  'video url',
  'video urls',
  'image',
  'video',
  'attachment',
  'attachments',
  'url',
] as const;

/** Canonical column names shown in the template / docs. */
export const CSV_CANONICAL_COLUMNS = ['date', 'time', 'channels', 'text', 'media_url'] as const;

export type CsvCanonicalColumn = (typeof CSV_CANONICAL_COLUMNS)[number];
