'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import { cn } from '@/shared/lib/cn';
import {
  AI_IMAGE_ORIENTATION_OPTIONS,
  AI_PROMPT_MAX_LENGTH,
  type AiImageOrientation,
} from '../../config/ai';
import { generateImage } from '../../lib/ai.client';
import { revalidateMediaLibrary } from '../../lib/media.client';
import type { MediaItem } from '../../types/media';

interface AiImageGeneratorProps {
  disabled: boolean;
  onUse: (media: MediaItem) => void;
}

const ASPECT_CLASSES: Record<AiImageOrientation, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[2/3]',
  landscape: 'aspect-[3/2]',
};

export function AiImageGenerator({ disabled, onUse }: AiImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [orientation, setOrientation] = useState<AiImageOrientation>('square');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ media: MediaItem; orientation: AiImageOrientation } | null>(
    null
  );

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const media = await generateImage({ prompt: prompt.trim(), orientation });
      setImage({ media, orientation });
      void revalidateMediaLibrary();
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : 'Could not create the image'
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Generate an image</h2>
        <p className="text-muted-foreground text-sm">
          Describe the picture you need. It is saved to your media library automatically.
        </p>
      </div>

      <SegmentedControl
        label="Orientation"
        options={AI_IMAGE_ORIENTATION_OPTIONS}
        value={orientation}
        onChange={setOrientation}
        disabled={generating}
      />

      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        maxLength={AI_PROMPT_MAX_LENGTH}
        rows={4}
        placeholder="e.g. A bright, modern office desk with a laptop showing growth charts, soft morning light"
        aria-label="Image description"
        className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none"
      />

      <Button
        variant="ai"
        onClick={generate}
        disabled={disabled || generating || prompt.trim().length < 3}
      >
        {generating ? 'Generating… this can take a minute' : 'Generate image'}
      </Button>

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      {image && (
        <div className="space-y-3">
          <div
            className={cn(
              'bg-surface-muted relative mx-auto w-full max-w-sm overflow-hidden rounded-lg',
              ASPECT_CLASSES[image.orientation]
            )}
          >
            <Image
              src={image.media.url}
              alt={prompt}
              fill
              unoptimized
              sizes="384px"
              className="object-cover"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">Saved to your media library.</p>
            <Button size="sm" onClick={() => onUse(image.media)}>
              Create a post with this image
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
