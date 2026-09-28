'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface AiVariationCardProps {
  index: number;
  posts: string[];
  onUse: () => void;
}

const COPIED_FEEDBACK_MS = 2000;

export function AiVariationCard({ index, posts, onUse }: AiVariationCardProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(posts.join('\n\n'));
    } catch {
      return; // clipboard access denied by the browser
    }
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs font-medium">
        Variation {index + 1}
        {posts.length > 1 && ` · thread of ${posts.length}`}
      </p>
      <ol className="space-y-2">
        {posts.map((post, postIndex) => (
          <li
            key={postIndex}
            className="bg-surface-muted rounded-md p-3 text-sm break-words whitespace-pre-wrap"
          >
            {post}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button size="sm" onClick={onUse}>
          Use in a post
        </Button>
        <Button variant="ghost" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
