'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/shared/components/ui/button';
import { MEDIA_ALLOWED_MIME_TYPES } from '../../config/media';
import { uploadMediaFile, validateMediaFile } from '../../lib/media.client';

interface MediaUploadButtonProps {
  onUploaded: () => void;
  onErrors: (errors: string[]) => void;
}

export function MediaUploadButton({ onUploaded, onErrors }: MediaUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

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

      const validationError = validateMediaFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      try {
        await uploadMediaFile(file);
        uploaded += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'upload failed'}`);
      }
    }

    setProgress(null);
    onErrors(errors);
    if (uploaded > 0) {
      onUploaded();
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={MEDIA_ALLOWED_MIME_TYPES.join(',')}
        className="hidden"
        onChange={handleChange}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={progress !== null}>
        {progress ? `Uploading ${progress.current} of ${progress.total}…` : 'Upload media'}
      </Button>
    </>
  );
}
