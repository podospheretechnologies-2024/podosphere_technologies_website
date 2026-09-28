import type { SegmentedOption } from '@/shared/components/ui/segmented-control';

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

export const AI_IMAGE_ORIENTATIONS = ['square', 'portrait', 'landscape'] as const;
export type AiImageOrientation = (typeof AI_IMAGE_ORIENTATIONS)[number];

export const AI_IMAGE_ORIENTATION_OPTIONS: SegmentedOption<AiImageOrientation>[] = [
  { value: 'square', label: 'Square' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];
