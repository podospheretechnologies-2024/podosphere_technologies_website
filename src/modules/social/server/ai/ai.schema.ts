import 'server-only';
import { z } from 'zod';
import {
  AI_IMAGE_ORIENTATIONS,
  AI_MIN_POST_LENGTH,
  AI_POST_FORMATS,
  AI_PROMPT_MAX_LENGTH,
} from '../../config/ai';
import {
  AI_IMAGE_COUNT_DEFAULT,
  AI_IMAGE_COUNT_MAX,
  AI_IMAGE_COUNT_MIN,
  IMAGE_PLATFORM_SIZES,
  IMAGE_STYLES,
} from '../../config/image-presets';
import { POST_CONTENT_MAX_LENGTH } from '../../config/posts';
import { CAPTION_TONE_PRESET_IDS } from './presets';

const maxLengthSchema = z.int().min(AI_MIN_POST_LENGTH).max(POST_CONTENT_MAX_LENGTH);

const tonePresetIdSchema = z.enum(CAPTION_TONE_PRESET_IDS).optional();

export const generatePostsSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Describe what the post should be about')
    .max(AI_PROMPT_MAX_LENGTH),
  format: z.enum(AI_POST_FORMATS).default('post'),
  maxLength: maxLengthSchema.optional(),
  tonePresetId: tonePresetIdSchema,
});

export const urlPostsSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: 'Enter a valid http(s) link' }),
  format: z.enum(AI_POST_FORMATS).default('post'),
  maxLength: maxLengthSchema.optional(),
  tonePresetId: tonePresetIdSchema,
});

export const splitThreadSchema = z.object({
  content: z.string().trim().min(1, 'Write the post first').max(POST_CONTENT_MAX_LENGTH),
  maxLength: maxLengthSchema,
});

export const generateImageSchema = z.object({
  prompt: z.string().trim().min(3, 'Describe the image').max(AI_PROMPT_MAX_LENGTH),
  /** Preferred over bare orientation when set; maps to the closest OpenAI size. */
  platformSize: z.enum(IMAGE_PLATFORM_SIZES).optional(),
  orientation: z.enum(AI_IMAGE_ORIENTATIONS).default('square'),
  style: z.enum(IMAGE_STYLES).optional(),
  /** 1–4 images in one OpenAI call when supported; defaults to 1 to keep cost down. */
  count: z.int().min(AI_IMAGE_COUNT_MIN).max(AI_IMAGE_COUNT_MAX).default(AI_IMAGE_COUNT_DEFAULT),
});

export type GeneratePostsBody = z.infer<typeof generatePostsSchema>;
export type UrlPostsBody = z.infer<typeof urlPostsSchema>;
export type SplitThreadBody = z.infer<typeof splitThreadSchema>;
export type GenerateImageBody = z.infer<typeof generateImageSchema>;
