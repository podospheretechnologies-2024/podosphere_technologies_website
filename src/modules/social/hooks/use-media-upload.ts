'use client';

import { useState } from 'react';
import { DEFAULT_MEDIA_FORMAT } from '../config/media';
import { revalidateMediaLibrary, uploadMediaFile, validateMediaFile } from '../lib/media.client';
import type { MediaFormat, MediaItem } from '../types/media';

export interface MediaUploadResult {
  uploaded: MediaItem[];
  errors: string[];
}

/**
 * Upload files into the media library. Server may attach vision alt/captionIdeas
 * and one platform variant (soft-fail when vision is off).
 */
export function useMediaUpload() {
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  async function uploadFiles(
    files: File[],
    format: MediaFormat = DEFAULT_MEDIA_FORMAT
  ): Promise<MediaUploadResult> {
    const uploaded: MediaItem[] = [];
    const errors: string[] = [];

    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length });

      const validationError = validateMediaFile(file, format);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      try {
        uploaded.push(await uploadMediaFile(file, format));
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`);
      }
    }

    setProgress(null);
    if (uploaded.length > 0) {
      await revalidateMediaLibrary();
    }
    return { uploaded, errors };
  }

  return { uploadFiles, progress };
}
