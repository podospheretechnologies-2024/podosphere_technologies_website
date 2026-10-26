import 'server-only';
import { z } from 'zod';
import {
  AI_CONTENT_FORMATS,
  AI_IMAGE_ORIENTATIONS,
  AI_MIN_POST_LENGTH,
  AI_POST_FORMATS,
  AI_PROMPT_MAX_LENGTH,
  AI_REEL_LENGTH_DEFAULT,
  AI_REEL_PLATFORMS,
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

const reelPlatformSchema = z.enum(AI_REEL_PLATFORMS).default('instagram');
const reelLengthSchema = z
  .union([z.literal(15), z.literal(30), z.literal(60)])
  .default(AI_REEL_LENGTH_DEFAULT);

export const generateReelSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Describe what the reel should be about')
    .max(AI_PROMPT_MAX_LENGTH),
  platform: reelPlatformSchema,
  lengthSeconds: reelLengthSchema,
  tonePresetId: tonePresetIdSchema,
});

export const competitorContentSchema = z.object({
  /** Pasted competitor captions / notes — inspiration only, never copied. */
  examples: z
    .string()
    .trim()
    .min(1, 'Paste at least one competitor caption or a short note about their content')
    .max(AI_PROMPT_MAX_LENGTH),
  format: z.enum(AI_CONTENT_FORMATS).default('post'),
  /** Optional extra direction (what we want to say differently). */
  notes: z.string().trim().max(1000).optional(),
  /** Used when format is "reel". */
  platform: reelPlatformSchema,
  lengthSeconds: reelLengthSchema,
  tonePresetId: tonePresetIdSchema,
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
export type GenerateReelBody = z.infer<typeof generateReelSchema>;
export type CompetitorContentBody = z.infer<typeof competitorContentSchema>;
