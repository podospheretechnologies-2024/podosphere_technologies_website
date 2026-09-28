import { apiFetch } from '@/shared/lib/fetcher';
import { getMediaMaxSize, MEDIA_ALLOWED_MIME_TYPES, type MediaMimeType } from '../config/media';
import { MEDIA_API_ROUTE } from '../hooks/use-media-library';
import type { MediaItem } from '../types/media';

function isAllowedMimeType(type: string): type is MediaMimeType {
  return (MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(type);
}

// Quick feedback in the browser; the server re-checks the real file content.
export function validateMediaFile(file: File): string | null {
  if (!isAllowedMimeType(file.type)) {
    return `${file.name}: unsupported file type`;
  }
  if (file.size > getMediaMaxSize(file.type)) {
    return `${file.name}: file is too large`;
  }
  return null;
}

export function uploadMediaFile(file: File): Promise<MediaItem> {
  return apiFetch<MediaItem>(MEDIA_API_ROUTE, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
}

export function deleteMediaItem(id: string): Promise<void> {
  return apiFetch<void>(`${MEDIA_API_ROUTE}/${id}`, { method: 'DELETE' });
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
