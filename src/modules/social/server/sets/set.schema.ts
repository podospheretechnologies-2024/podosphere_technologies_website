import 'server-only';
import { z } from 'zod';
import { POST_CONTENT_MAX_LENGTH, POST_MAX_MEDIA, POST_MAX_THREAD_ITEMS } from '../../config/posts';
import { POST_MAX_TAGS, TEMPLATE_NAME_MAX_LENGTH } from '../../config/settings';

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name the template')
  .max(TEMPLATE_NAME_MAX_LENGTH, 'Template name is too long');

export const createSetSchema = z.object({
  name: nameSchema,
  integrationIds: z.array(z.string().min(1)).max(50).default([]),
  tagIds: z.array(z.string().min(1)).max(POST_MAX_TAGS).default([]),
  values: z
    .array(
      z.object({
        content: z.string().max(POST_CONTENT_MAX_LENGTH),
        mediaIds: z.array(z.string().min(1)).max(POST_MAX_MEDIA).default([]),
      })
    )
    .min(1)
    .max(POST_MAX_THREAD_ITEMS),
});

export const renameSetSchema = z.object({ name: nameSchema });

export type CreateSetBody = z.infer<typeof createSetSchema>;
export type RenameSetBody = z.infer<typeof renameSetSchema>;
