import type { SegmentedOption } from '@/shared/components/ui/segmented-control';

// Text AI providers an admin can choose per client / workspace (client-safe: used by the UI and,
// re-exported, by the server provider layer). The API key for each is stored encrypted server-side.
export const AI_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === 'string' && (AI_PROVIDERS as readonly string[]).includes(value);
}

export interface AiProviderOption {
  value: AiProvider;
  label: string;
  /** Shown as the model field placeholder = the server default for that provider. */
  modelPlaceholder: string;
  keyHint: string;
}

export const AI_PROVIDER_OPTIONS: AiProviderOption[] = [
  {
    value: 'anthropic',
    label: 'Claude (Anthropic)',
    modelPlaceholder: 'claude-opus-5',
    keyHint: 'Anthropic API key — starts with sk-ant-',
  },
  {
    value: 'openai',
    label: 'ChatGPT (OpenAI)',
    modelPlaceholder: 'gpt-4o',
    keyHint: 'OpenAI API key — starts with sk-',
  },
  {
    value: 'gemini',
    label: 'Gemini (Google)',
    modelPlaceholder: 'gemini-flash-latest',
    keyHint: 'Google AI Studio API key',
  },
];

export const AI_POST_VARIATIONS = 3;
export const AI_PROMPT_MAX_LENGTH = 5000;
export const AI_MIN_POST_LENGTH = 50;

export const AI_POST_FORMATS = ['post', 'thread'] as const;
export type AiPostFormat = (typeof AI_POST_FORMATS)[number];

export const AI_POST_FORMAT_OPTIONS: SegmentedOption<AiPostFormat>[] = [
  { value: 'post', label: 'Single post' },
  { value: 'thread', label: 'Thread' },
];

export const AI_SOURCES = ['idea', 'url'] as const;
export type AiSource = (typeof AI_SOURCES)[number];

export const AI_SOURCE_OPTIONS: SegmentedOption<AiSource>[] = [
  { value: 'idea', label: 'From an idea' },
  { value: 'url', label: 'From a link' },
];

// Content Studio: what kind of thing we generate (a feed post vs a short-video reel).
export const AI_CONTENT_FORMATS = ['post', 'reel'] as const;
export type AiContentFormat = (typeof AI_CONTENT_FORMATS)[number];

export const AI_CONTENT_FORMAT_OPTIONS: SegmentedOption<AiContentFormat>[] = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
];

// Reel scripting: target platform and rough length (used to size the shot list).
export const AI_REEL_PLATFORMS = ['instagram', 'youtube', 'facebook'] as const;
export type AiReelPlatform = (typeof AI_REEL_PLATFORMS)[number];

export const AI_REEL_PLATFORM_LABELS: Record<AiReelPlatform, string> = {
  instagram: 'Instagram Reels',
  youtube: 'YouTube Shorts',
  facebook: 'Facebook Reels',
};

export const AI_REEL_PLATFORM_OPTIONS: SegmentedOption<AiReelPlatform>[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
];

// Numeric values, so these drive a plain toggle rather than the string-only SegmentedControl.
export const AI_REEL_LENGTHS_SECONDS = [15, 30, 60] as const;
export type AiReelLengthSeconds = (typeof AI_REEL_LENGTHS_SECONDS)[number];
export const AI_REEL_LENGTH_DEFAULT: AiReelLengthSeconds = 30;

export const AI_IMAGE_ORIENTATIONS = ['square', 'portrait', 'landscape'] as const;
export type AiImageOrientation = (typeof AI_IMAGE_ORIENTATIONS)[number];

export const AI_IMAGE_ORIENTATION_OPTIONS: SegmentedOption<AiImageOrientation>[] = [
  { value: 'square', label: 'Square' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];
