import type { SegmentedOption } from '@/shared/components/ui/segmented-control';
import type { AiImageOrientation } from './ai';

/** Visual styles offered in the image generator (and accepted by the API). */
export const IMAGE_STYLES = [
  'product',
  'lifestyle',
  'flat-illustration',
  'photo',
  '3d-render',
  'minimal',
] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export interface ImageStylePreset {
  value: ImageStyle;
  label: string;
  /** Short phrase appended / given to the prompt expander. */
  promptHint: string;
}

export const IMAGE_STYLE_PRESETS: readonly ImageStylePreset[] = [
  {
    value: 'product',
    label: 'Product',
    promptHint:
      'Clean product photography on a simple surface, soft studio lighting, sharp focus on the subject, generous empty space for a headline',
  },
  {
    value: 'lifestyle',
    label: 'Lifestyle',
    promptHint:
      'Natural lifestyle scene with people or context using the product, warm ambient light, candid composition, authentic mood',
  },
  {
    value: 'flat-illustration',
    label: 'Flat illustration',
    promptHint:
      'Flat vector-style illustration, bold shapes, limited colour palette, no gradients or photorealism, clear focal subject',
  },
  {
    value: 'photo',
    label: 'Photo',
    promptHint:
      'Photorealistic editorial photo, natural colour grade, shallow depth of field, described camera and lens',
  },
  {
    value: '3d-render',
    label: '3D render',
    promptHint:
      'Polished 3D CGI render, soft global illumination, subtle reflections, modern materials, studio backdrop',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    promptHint:
      'Minimal composition, lots of negative space, simple geometric forms, restrained colour, calm and uncluttered',
  },
] as const;

export const IMAGE_STYLE_OPTIONS: SegmentedOption<ImageStyle>[] = IMAGE_STYLE_PRESETS.map(
  (preset) => ({ value: preset.value, label: preset.label })
);

/** Platform-oriented size presets; each maps to the closest OpenAI image size. */
export const IMAGE_PLATFORM_SIZES = [
  'ig-square',
  'ig-portrait',
  'ig-story',
  'ig-reel-thumb',
  'fb-landscape',
  'linkedin',
  'square',
] as const;
export type ImagePlatformSize = (typeof IMAGE_PLATFORM_SIZES)[number];

export interface ImagePlatformSizePreset {
  value: ImagePlatformSize;
  label: string;
  shortLabel: string;
  orientation: AiImageOrientation;
  /** Aspect ratio description for the prompt expander. */
  aspectHint: string;
  description: string;
}

export const IMAGE_PLATFORM_SIZE_PRESETS: readonly ImagePlatformSizePreset[] = [
  {
    value: 'ig-square',
    label: 'Instagram square',
    shortLabel: 'IG 1:1',
    orientation: 'square',
    aspectHint: '1:1 square social feed crop',
    description: 'Instagram feed square',
  },
  {
    value: 'ig-portrait',
    label: 'Instagram portrait',
    shortLabel: 'IG 4:5',
    orientation: 'portrait',
    aspectHint: '4:5 vertical Instagram feed crop',
    description: 'Instagram feed 4:5',
  },
  {
    value: 'ig-story',
    label: 'Instagram story',
    shortLabel: 'Story 9:16',
    orientation: 'portrait',
    aspectHint: '9:16 full-bleed Instagram Story / Reels frame',
    description: 'Story / Reels full frame',
  },
  {
    value: 'ig-reel-thumb',
    label: 'Reel thumbnail',
    shortLabel: 'Reel thumb',
    orientation: 'portrait',
    aspectHint: '9:16 Reels cover thumbnail with a clear central subject',
    description: 'Reels cover thumb',
  },
  {
    value: 'fb-landscape',
    label: 'Facebook landscape',
    shortLabel: 'FB 1.91:1',
    orientation: 'landscape',
    aspectHint: '1.91:1 Facebook link / feed landscape crop',
    description: 'Facebook landscape',
  },
  {
    value: 'linkedin',
    label: 'LinkedIn',
    shortLabel: 'LI 1.91:1',
    orientation: 'landscape',
    aspectHint: '1.91:1 LinkedIn landscape share image',
    description: 'LinkedIn landscape',
  },
  {
    value: 'square',
    label: 'Square',
    shortLabel: '1:1',
    orientation: 'square',
    aspectHint: '1:1 square',
    description: 'Generic square',
  },
] as const;

export const IMAGE_PLATFORM_SIZE_OPTIONS: SegmentedOption<ImagePlatformSize>[] =
  IMAGE_PLATFORM_SIZE_PRESETS.map((preset) => ({
    value: preset.value,
    label: preset.shortLabel,
  }));

export const AI_IMAGE_COUNT_MIN = 1;
export const AI_IMAGE_COUNT_MAX = 4;
export const AI_IMAGE_COUNT_DEFAULT = 1;

export function imageStylePreset(style: ImageStyle | undefined): ImageStylePreset | undefined {
  return style ? IMAGE_STYLE_PRESETS.find((preset) => preset.value === style) : undefined;
}

export function imagePlatformSizePreset(
  size: ImagePlatformSize | undefined
): ImagePlatformSizePreset | undefined {
  return size ? IMAGE_PLATFORM_SIZE_PRESETS.find((preset) => preset.value === size) : undefined;
}
