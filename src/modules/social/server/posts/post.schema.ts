import 'server-only';
import { z } from 'zod';
import {
  POST_CONTENT_MAX_LENGTH,
  POST_LIST_FILTER_VALUES,
  POST_MAX_MEDIA,
  POST_MAX_THREAD_ITEMS,
  POST_SAVE_TYPES,
} from '../../config/posts';

const threadItemSchema = z.object({
  content: z.string().max(POST_CONTENT_MAX_LENGTH, 'Post is too long'),
  mediaIds: z.array(z.string().min(1)).max(POST_MAX_MEDIA, 'Too many media files').default([]),
  delay: z.number().int().min(0).max(10_080).default(0),
});

const channelPostSchema = z.object({
  integrationId: z.string().min(1),
  values: z
    .array(threadItemSchema)
    .min(1, 'A post needs content')
    .max(POST_MAX_THREAD_ITEMS, 'Too many comments'),
});

export const savePostSchema = z.object({
  type: z.enum(POST_SAVE_TYPES),
  date: z.iso.datetime({ offset: true }),
  posts: z
    .array(channelPostSchema)
    .min(1, 'Select at least one channel')
    .refine(
      (posts) => new Set(posts.map((post) => post.integrationId)).size === posts.length,
      'Each channel can only be selected once'
    ),
});

export type SavePostBody = z.infer<typeof savePostSchema>;

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  state: z.enum(POST_LIST_FILTER_VALUES).default('all'),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
