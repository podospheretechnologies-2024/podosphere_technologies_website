'use client';

import Link from 'next/link';
import { cn } from '@/shared/lib/cn';
import { socialSections } from '../../../config/navigation';
import { POST_MAX_TAGS } from '../../../config/settings';
import { useTags } from '../../../hooks/use-settings';
import { TagChip } from '../../settings/tag-chip';

interface TagPickerProps {
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function TagPicker({ selectedIds, onToggle }: TagPickerProps) {
  const { data: tags, error } = useTags();

  if (error) {
    return <p className="text-danger text-sm">Could not load tags</p>;
  }
  if (!tags) {
    return <p className="text-muted-foreground text-sm">Loading tags…</p>;
  }
  if (tags.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No tags yet. Create them in{' '}
        <Link href={socialSections.settings.href} className="underline">
          Settings
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const selected = selectedIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.id)}
            disabled={!selected && selectedIds.length >= POST_MAX_TAGS}
            aria-pressed={selected}
            className={cn(
              'rounded-full transition disabled:cursor-not-allowed',
              selected ? 'ring-primary ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'
            )}
          >
            <TagChip tag={tag} />
          </button>
        );
      })}
    </div>
  );
}
