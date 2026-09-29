'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { getAllowedMimeTypes, MEDIA_FORMAT_OPTIONS } from '../../config/media';
import { uploadMediaFile, validateMediaFile } from '../../lib/media.client';
import type { MediaFormat } from '../../types/media';

interface MediaUploadButtonProps {
  format: MediaFormat;
  onUploaded: (format: MediaFormat) => void;
  onErrors: (errors: string[]) => void;
}

export function MediaUploadButton({ format, onUploaded, onErrors }: MediaUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const formatLabel = MEDIA_FORMAT_OPTIONS.find((option) => option.value === format)?.label;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }

    const errors: string[] = [];
    let uploaded = 0;

    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length });

      const validationError = validateMediaFile(file, format);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      try {
        await uploadMediaFile(file, format);
        uploaded += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`);
      }
    }

    setProgress(null);
    onErrors(errors);
    if (uploaded > 0) {
      onUploaded(format);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={getAllowedMimeTypes(format).join(',')}
        className="hidden"
        onChange={handleChange}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={progress !== null}>
        {progress
          ? `Uploading ${progress.current} of ${progress.total}…`
          : `Upload ${formatLabel?.toLowerCase() ?? 'media'}`}
      </Button>
    </>
  );
}
