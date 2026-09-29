import { mutate } from 'swr';
import { apiFetch } from '@/shared/lib/fetcher';
import {
  DEFAULT_MEDIA_FORMAT,
  getAllowedMimeTypes,
  getMediaMaxSize,
  MEDIA_ALLOWED_MIME_TYPES,
  MEDIA_FORMAT_VIDEO_ONLY,
  type MediaMimeType,
} from '../config/media';
import { MEDIA_API_ROUTE } from '../hooks/use-media-library';
import type { MediaFormat, MediaItem } from '../types/media';

function isAllowedMimeType(type: string): type is MediaMimeType {
  return (MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

// Quick feedback in the browser; the server re-checks the real file content.
export function validateMediaFile(
  file: File,
  format: MediaFormat = DEFAULT_MEDIA_FORMAT
): string | null {
  if (!isAllowedMimeType(file.type)) {
    return `${file.name}: unsupported file type`;
  }
  if (!getAllowedMimeTypes(format).includes(file.type)) {
    return MEDIA_FORMAT_VIDEO_ONLY[format]
      ? `${file.name}: reels must be MP4 videos`
      : `${file.name}: unsupported file type`;
  }
  if (file.size > getMediaMaxSize(file.type)) {
    return `${file.name}: file is too large`;
  }
  return null;
}

export function uploadMediaFile(
  file: File,
  format: MediaFormat = DEFAULT_MEDIA_FORMAT
): Promise<MediaItem> {
  return apiFetch<MediaItem>(MEDIA_API_ROUTE, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-Media-Format': format,
    },
    body: file,
  });
}

export function deleteMediaItem(id: string): Promise<void> {
  return apiFetch<void>(`${MEDIA_API_ROUTE}/${id}`, { method: 'DELETE' });
}

// Refreshes every cached media page, e.g. after a file was added outside the library.
export function revalidateMediaLibrary(): Promise<unknown> {
  return mutate((key) => typeof key === 'string' && key.startsWith(MEDIA_API_ROUTE));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
