import 'server-only';
import { z } from 'zod';
import {
  AI_IMAGE_ORIENTATIONS,
  AI_MIN_POST_LENGTH,
  AI_POST_FORMATS,
  AI_PROMPT_MAX_LENGTH,
} from '../../config/ai';
import { POST_CONTENT_MAX_LENGTH } from '../../config/posts';

const maxLengthSchema = z.int().min(AI_MIN_POST_LENGTH).max(POST_CONTENT_MAX_LENGTH);

export const generatePostsSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Describe what the post should be about')
    .max(AI_PROMPT_MAX_LENGTH),
  format: z.enum(AI_POST_FORMATS).default('post'),
  maxLength: maxLengthSchema.optional(),
});

export const urlPostsSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) link' }),
  format: z.enum(AI_POST_FORMATS).default('post'),
  maxLength: maxLengthSchema.optional(),
});

export const splitThreadSchema = z.object({
  content: z.string().trim().min(1, 'Write the post first').max(POST_CONTENT_MAX_LENGTH),
  maxLength: maxLengthSchema,
});

export const generateImageSchema = z.object({
  prompt: z.string().trim().min(3, 'Describe the image').max(AI_PROMPT_MAX_LENGTH),
  orientation: z.enum(AI_IMAGE_ORIENTATIONS).default('square'),
});

export type GeneratePostsBody = z.infer<typeof generatePostsSchema>;
export type UrlPostsBody = z.infer<typeof urlPostsSchema>;
export type SplitThreadBody = z.infer<typeof splitThreadSchema>;
export type GenerateImageBody = z.infer<typeof generateImageSchema>;
