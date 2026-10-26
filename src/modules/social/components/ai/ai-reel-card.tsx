'use client';

import { Clapperboard, Music, Type } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import type { AiReelScript } from '../../types/ai';

interface AiReelCardProps {
  reel: AiReelScript;
  /** Opens the caption in Create Post; hidden when the viewer can't manage campaigns. */
  onUseCaption?: () => void;
}

const COPIED_FEEDBACK_MS = 2000;

function reelToPlainText(reel: AiReelScript): string {
  const scenes = reel.scenes
    .map(
      (scene, index) =>
        `${index + 1}. [${scene.timecode}] ${scene.visual}${
          scene.onScreenText ? `\n   On-screen: ${scene.onScreenText}` : ''
        }`
    )
    .join('\n');

  return [
    reel.concept && `Concept: ${reel.concept}`,
    reel.hook && `Hook: ${reel.hook}`,
    scenes && `\nScenes:\n${scenes}`,
    reel.voiceover && `\nVoiceover: ${reel.voiceover}`,
    reel.audioIdea && `Audio: ${reel.audioIdea}`,
    reel.cta && `CTA: ${reel.cta}`,
    reel.caption && `\nCaption:\n${reel.caption}`,
    reel.hashtags.length ? reel.hashtags.join(' ') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function AiReelCard({ reel, onUseCaption }: AiReelCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reelToPlainText(reel));
    } catch {
      return; // clipboard access denied by the browser
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  }

  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      {reel.concept && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clapperboard className="text-primary size-4 shrink-0" />
          <span>{reel.concept}</span>
        </p>
      )}

      {reel.hook && (
        <div className="bg-surface-muted rounded-md p-3">
          <p className="text-muted-foreground text-xs font-medium">Hook (first ~2s)</p>
          <p className="mt-1 text-sm font-medium">{reel.hook}</p>
        </div>
      )}

      {reel.scenes.length > 0 && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium">Shot list</p>
          <ol className="space-y-2">
            {reel.scenes.map((scene, index) => (
              <li key={index} className="border-border rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="break-words">{scene.visual}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    {scene.timecode}
                  </span>
                </div>
                {scene.onScreenText && (
                  <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
                    <Type className="size-3.5 shrink-0" />
                    <span className="break-words">{scene.onScreenText}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {reel.voiceover && (
        <div>
          <p className="text-muted-foreground text-xs font-medium">Voiceover</p>
          <p className="mt-1 text-sm break-words whitespace-pre-wrap">{reel.voiceover}</p>
        </div>
      )}

      {reel.audioIdea && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Music className="size-4 shrink-0" />
          <span className="break-words">{reel.audioIdea}</span>
        </p>
      )}

      {reel.caption && (
        <div className="bg-surface-muted rounded-md p-3">
          <p className="text-muted-foreground text-xs font-medium">Caption</p>
          <p className="mt-1 text-sm break-words whitespace-pre-wrap">{reel.caption}</p>
          {reel.hashtags.length > 0 && (
            <p className="text-muted-foreground mt-2 text-xs break-words">
              {reel.hashtags.join(' ')}
            </p>
          )}
        </div>
      )}

      {reel.cta && (
        <p className="text-sm">
          <span className="text-muted-foreground font-medium">CTA: </span>
          {reel.cta}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onUseCaption && (
          <Button size="sm" onClick={onUseCaption}>
            Use caption in a post
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy script'}
        </Button>
      </div>
    </div>
  );
}
