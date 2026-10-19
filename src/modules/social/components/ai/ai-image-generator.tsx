'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import { cn } from '@/shared/lib/cn';
import { AI_PROMPT_MAX_LENGTH } from '../../config/ai';
import {
  AI_IMAGE_COUNT_DEFAULT,
  AI_IMAGE_COUNT_MAX,
  AI_IMAGE_COUNT_MIN,
  IMAGE_PLATFORM_SIZE_OPTIONS,
  IMAGE_PLATFORM_SIZE_PRESETS,
  IMAGE_STYLE_OPTIONS,
  type ImagePlatformSize,
  type ImageStyle,
} from '../../config/image-presets';
import { useAiStatus } from '../../hooks/use-ai-status';
import { generateImage } from '../../lib/ai.client';
import { revalidateMediaLibrary } from '../../lib/media.client';
import type { MediaItem } from '../../types/media';

interface AiImageGeneratorProps {
  disabled: boolean;
  onUse: (media: MediaItem) => void;
}

const ASPECT_CLASSES: Record<ImagePlatformSize, string> = {
  'ig-square': 'aspect-square',
  'ig-portrait': 'aspect-[4/5]',
  'ig-story': 'aspect-[9/16]',
  'ig-reel-thumb': 'aspect-[9/16]',
  'fb-landscape': 'aspect-[1.91/1]',
  linkedin: 'aspect-[1.91/1]',
  square: 'aspect-square',
};

const COUNT_OPTIONS = Array.from(
  { length: AI_IMAGE_COUNT_MAX - AI_IMAGE_COUNT_MIN + 1 },
  (_, index) => {
    const value = String(AI_IMAGE_COUNT_MIN + index);
    return { value, label: value };
  }
);

export function AiImageGenerator({ disabled, onUse }: AiImageGeneratorProps) {
  const { data: aiStatus } = useAiStatus();
  const imageReady = aiStatus?.imageConfigured ?? false;

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyle>('product');
  const [platformSize, setPlatformSize] = useState<ImagePlatformSize>('ig-square');
  const [count, setCount] = useState(AI_IMAGE_COUNT_DEFAULT);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<{ media: MediaItem[]; platformSize: ImagePlatformSize } | null>(
    null
  );

  const sizeMeta = IMAGE_PLATFORM_SIZE_PRESETS.find((preset) => preset.value === platformSize);

  async function generate() {
    setError(null);
    if (!imageReady) {
      setError('Image generation needs OPENAI_API_KEY in .env.');
      return;
    }
    setGenerating(true);
    try {
      const media = await generateImage({
        prompt: prompt.trim(),
        platformSize,
        orientation: sizeMeta?.orientation ?? 'square',
        style,
        count,
      });
      setImages({ media, platformSize });
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
          Pick a style and platform size, then describe the picture. Brand colours from the client
          brand kit are applied when set. Images save to your media library.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium">Style</p>
        <SegmentedControl
          label="Style"
          options={IMAGE_STYLE_OPTIONS}
          value={style}
          onChange={setStyle}
          disabled={generating}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium">
          Size{sizeMeta ? ` · ${sizeMeta.description}` : ''}
        </p>
        <SegmentedControl
          label="Platform size"
          options={IMAGE_PLATFORM_SIZE_OPTIONS}
          value={platformSize}
          onChange={setPlatformSize}
          disabled={generating}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium">
          Variations (each image is billed separately)
        </p>
        <SegmentedControl
          label="Variations"
          options={COUNT_OPTIONS}
          value={String(count)}
          onChange={(value) => setCount(Number(value))}
          disabled={generating}
        />
      </div>

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
        onClick={() => void generate()}
        disabled={disabled || generating || !imageReady || prompt.trim().length < 3}
      >
        {generating
          ? 'Generating… this can take a minute'
          : count > 1
            ? `Generate ${count} images`
            : 'Generate image'}
      </Button>

      {!imageReady && (
        <p className="text-muted-foreground text-xs">
          Soft-disabled until OPENAI_API_KEY is set. Caption AI can still run on Claude alone.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      {images && images.media.length > 0 && (
        <div className="space-y-3">
          <div
            className={cn(
              'grid gap-3',
              images.media.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'
            )}
          >
            {images.media.map((item) => (
              <div key={item.id} className="space-y-2">
                <div
                  className={cn(
                    'bg-surface-muted relative mx-auto w-full max-w-sm overflow-hidden rounded-lg',
                    ASPECT_CLASSES[images.platformSize]
                  )}
                >
                  <Image
                    src={item.url}
                    alt={prompt}
                    fill
                    unoptimized
                    sizes="384px"
                    className="object-cover"
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => onUse(item)}>
                    Create a post with this image
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {images.media.length === 1
              ? 'Saved to your media library.'
              : `${images.media.length} images saved to your media library.`}
          </p>
        </div>
      )}
    </Card>
  );
}
