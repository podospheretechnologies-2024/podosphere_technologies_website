import type { MediaFormat } from './media';

/** Common social image targets (cover crop). */
export const PLATFORM_IMAGE_SIZES = {
  ig_square: { width: 1080, height: 1080, label: 'Instagram square' },
  ig_feed: { width: 1080, height: 1350, label: 'Instagram feed (4:5)' },
  ig_story: { width: 1080, height: 1920, label: 'Instagram story / reel cover (9:16)' },
  fb_landscape: { width: 1200, height: 630, label: 'Facebook / link preview (1.91:1)' },
  linkedin: { width: 1200, height: 627, label: 'LinkedIn landscape' },
} as const;

export type PlatformImageSizeKey = keyof typeof PLATFORM_IMAGE_SIZES;

export const PLATFORM_IMAGE_SIZE_KEYS = [
  'ig_square',
  'ig_feed',
  'ig_story',
  'fb_landscape',
  'linkedin',
] as const satisfies readonly PlatformImageSizeKey[];

/** Default stored variant per library format (one variant on upload). */
export function defaultVariantKeyForFormat(format: MediaFormat): PlatformImageSizeKey {
  if (format === 'story') return 'ig_story';
  if (format === 'reel') return 'ig_story';
  return 'ig_feed';
}
