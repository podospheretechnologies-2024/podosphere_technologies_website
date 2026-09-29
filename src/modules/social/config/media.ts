export const MEDIA_PAGE_SIZE = 18;

export const MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'video/mp4',
] as const;

export type MediaMimeType = (typeof MEDIA_ALLOWED_MIME_TYPES)[number];

const MB = 1024 * 1024;

export const MEDIA_MAX_IMAGE_SIZE = 10 * MB;
export const MEDIA_MAX_VIDEO_SIZE = 1024 * MB;

export function getMediaMaxSize(mimeType: MediaMimeType): number {
  return mimeType.startsWith('video/') ? MEDIA_MAX_VIDEO_SIZE : MEDIA_MAX_IMAGE_SIZE;
}

export const MEDIA_FORMATS = ['post', 'reel', 'story'] as const;

export type MediaFormat = (typeof MEDIA_FORMATS)[number];

export const DEFAULT_MEDIA_FORMAT: MediaFormat = 'post';

export const MEDIA_FORMAT_OPTIONS = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
] as const satisfies readonly { value: MediaFormat; label: string }[];

export const MEDIA_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'post', label: 'Posts' },
  { value: 'reel', label: 'Reels' },
  { value: 'story', label: 'Stories' },
] as const satisfies readonly { value: MediaFormat | 'all'; label: string }[];

// Reels are video only, like on Instagram.
export const MEDIA_FORMAT_VIDEO_ONLY: Record<MediaFormat, boolean> = {
  post: false,
  reel: true,
  story: false,
};

export function getAllowedMimeTypes(format: MediaFormat): readonly MediaMimeType[] {
  return MEDIA_FORMAT_VIDEO_ONLY[format]
    ? MEDIA_ALLOWED_MIME_TYPES.filter((type) => type.startsWith('video/'))
    : MEDIA_ALLOWED_MIME_TYPES;
}

// How long a story image stays on screen before the progress bar restarts.
export const STORY_IMAGE_DURATION_MS = 5000;
