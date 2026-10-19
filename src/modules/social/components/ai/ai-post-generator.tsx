'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import {
  AI_POST_FORMAT_OPTIONS,
  AI_PROMPT_MAX_LENGTH,
  AI_SOURCE_OPTIONS,
  type AiPostFormat,
  type AiSource,
} from '../../config/ai';
import { generatePosts, generatePostsFromUrl } from '../../lib/ai.client';
import type { CaptionTonePresetId } from '../../server/ai/presets';
import type { AiPostVariations } from '../../types/ai';
import { AiVariationCard } from './ai-variation-card';
import { CaptionTonePicker } from './caption-tone-picker';

interface AiPostGeneratorProps {
  disabled: boolean;
  onUse: (posts: string[]) => void;
  /** Prefill idea + tone (e.g. from festival calendar) */
  seed?: { topic: string; tonePresetId?: CaptionTonePresetId | null } | null;
}

export function AiPostGenerator({ disabled, onUse, seed }: AiPostGeneratorProps) {
  const [source, setSource] = useState<AiSource>('idea');
  const [format, setFormat] = useState<AiPostFormat>('post');
  const [idea, setIdea] = useState(seed?.topic ?? '');
  const [url, setUrl] = useState('');
  const [tonePresetId, setTonePresetId] = useState<CaptionTonePresetId | null>(
    seed?.tonePresetId ?? null
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiPostVariations | null>(null);

  const input = source === 'idea' ? idea.trim() : url.trim();

  async function generate() {
    setError(null);
    setGenerating(true);
    try {
      const tone = tonePresetId ?? undefined;
      setResult(
        source === 'idea'
          ? await generatePosts({ content: input, format, tonePresetId: tone })
          : await generatePostsFromUrl({ url: input, format, tonePresetId: tone })
      );
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not write posts');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Write posts</h2>
        <p className="text-muted-foreground text-sm">
          Describe an idea or paste a link to an article and get ready-to-edit posts.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Source"
          options={AI_SOURCE_OPTIONS}
          value={source}
          onChange={setSource}
          disabled={generating}
        />
        <SegmentedControl
          label="Format"
          options={AI_POST_FORMAT_OPTIONS}
          value={format}
          onChange={setFormat}
          disabled={generating}
        />
      </div>

      <CaptionTonePicker
        value={tonePresetId}
        onChange={setTonePresetId}
        disabled={generating}
      />

      {source === 'idea' ? (
        <textarea
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          maxLength={AI_PROMPT_MAX_LENGTH}
          rows={5}
          placeholder="e.g. We just launched a free website audit for small businesses. Mention the 24h turnaround."
          aria-label="Post idea"
          className="border-border placeholder:text-muted-foreground block w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none"
        />
      ) : (
        <Input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/blog/article"
          aria-label="Article link"
        />
      )}

      <Button variant="ai" onClick={generate} disabled={disabled || generating || !input}>
        {generating ? 'Writing…' : 'Generate posts'}
      </Button>

      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-3 text-sm"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.source && (
            <p className="text-muted-foreground text-sm">
              Based on{' '}
              <a
                href={result.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline"
              >
                {result.source.title ?? result.source.url}
              </a>
            </p>
          )}
          {result.variations.map((posts, index) => (
            <AiVariationCard key={index} index={index} posts={posts} onUse={() => onUse(posts)} />
          ))}
        </div>
      )}
    </Card>
  );
}
