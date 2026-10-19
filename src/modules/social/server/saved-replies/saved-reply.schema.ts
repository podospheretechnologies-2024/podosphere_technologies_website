import 'server-only';
import { z } from 'zod';

export const SAVED_REPLY_TITLE_MAX = 120;
export const SAVED_REPLY_BODY_MAX = 8000;

export const saveSavedReplySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(SAVED_REPLY_TITLE_MAX, 'Title is too long'),
  body: z
    .string()
    .trim()
    .min(1, 'Reply body is required')
    .max(SAVED_REPLY_BODY_MAX, 'Reply body is too long'),
});

export type SaveSavedReplyBody = z.infer<typeof saveSavedReplySchema>;
