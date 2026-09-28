'use client';

import Link from 'next/link';
import { useState } from 'react';
import { socialSections } from '../../config/navigation';
import { useAiStatus } from '../../hooks/use-ai-status';
import { revalidatePosts } from '../../lib/posts.client';
import type { MediaItem } from '../../types/media';
import { PostComposer, type ComposerInitialItem } from '../posts/composer/post-composer';
import { AiImageGenerator } from './ai-image-generator';
import { AiPostGenerator } from './ai-post-generator';

type ComposerState = { open: false } | { open: true; items: ComposerInitialItem[] };

export function AiStudio() {
  const { data: status, error } = useAiStatus();
  const [composer, setComposer] = useState<ComposerState>({ open: false });
  const [saved, setSaved] = useState(false);

  const configured = status?.configured ?? false;

  function openComposer(items: ComposerInitialItem[]) {
    setSaved(false);
    setComposer({ open: true, items });
  }

  function composeWithImage(media: MediaItem) {
    openComposer([
      { content: '', media: [{ id: media.id, url: media.url, type: media.type, alt: media.alt }] },
    ]);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-lg border p-4 text-sm"
        >
          {error instanceof Error ? error.message : 'Could not load the AI settings'}
        </div>
      )}
      {status && !configured && (
        <div role="status" className="border-border bg-surface-muted rounded-lg border p-4 text-sm">
          AI is switched off. Add <code className="font-mono">OPENAI_API_KEY</code> to{' '}
          <code className="font-mono">.env</code> and restart the server to use the AI Studio.
        </div>
      )}
      {saved && (
        <div role="status" className="border-border bg-surface-muted rounded-lg border p-4 text-sm">
          Post saved. You can find it in the{' '}
          <Link href={socialSections.calendar.href} className="underline">
            calendar
          </Link>
          .
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <AiPostGenerator
          disabled={!configured}
          onUse={(posts) => openComposer(posts.map((content) => ({ content, media: [] })))}
        />
        <AiImageGenerator disabled={!configured} onUse={composeWithImage} />
      </div>

      <PostComposer
        open={composer.open}
        group={null}
        initialItems={composer.open ? composer.items : undefined}
        onClose={() => setComposer({ open: false })}
        onSaved={() => {
          setComposer({ open: false });
          setSaved(true);
          void revalidatePosts();
        }}
      />
    </div>
  );
}
