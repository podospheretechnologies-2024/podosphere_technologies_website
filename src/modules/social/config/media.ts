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
