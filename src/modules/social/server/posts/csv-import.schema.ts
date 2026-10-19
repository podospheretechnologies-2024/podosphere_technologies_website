import 'server-only';
import { z } from 'zod';
import {
  CSV_IMPORT_DEFAULT_TIMEZONE,
  CSV_IMPORT_MAX_ROWS,
} from '../../config/csv-import';
import { POST_CONTENT_MAX_LENGTH, POST_MAX_MEDIA } from '../../config/posts';

const timeZoneSchema = z.string().trim().min(1).max(64).refine((value) => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Invalid time zone');

export const csvImportPreviewSchema = z.object({
  csv: z
    .string()
    .min(1, 'CSV is empty')
    .max(1_048_576, 'CSV is too large (max 1 MB)'),
  timeZone: timeZoneSchema.default(CSV_IMPORT_DEFAULT_TIMEZONE),
});

export type CsvImportPreviewBody = z.infer<typeof csvImportPreviewSchema>;

const createRowSchema = z.object({
  rowIndex: z.number().int().min(2).max(CSV_IMPORT_MAX_ROWS + 1),
  publishAt: z.iso.datetime({ offset: true }),
  channelIds: z
    .array(z.string().min(1))
    .min(1, 'Select at least one channel')
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Each channel can only be selected once'
    ),
  text: z.string().max(POST_CONTENT_MAX_LENGTH, 'Post is too long'),
  mediaUrls: z
    .array(z.string().url().max(2000))
    .max(POST_MAX_MEDIA, 'Too many media URLs')
    .default([]),
});

export const csvImportCreateSchema = z.object({
  rows: z
    .array(createRowSchema)
    .min(1, 'No rows to import')
    .max(CSV_IMPORT_MAX_ROWS, `At most ${CSV_IMPORT_MAX_ROWS} rows`),
  timeZone: timeZoneSchema.default(CSV_IMPORT_DEFAULT_TIMEZONE),
});

export type CsvImportCreateBody = z.infer<typeof csvImportCreateSchema>;
