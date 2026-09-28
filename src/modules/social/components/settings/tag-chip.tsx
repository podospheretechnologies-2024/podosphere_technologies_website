import { cn } from '@/shared/lib/cn';
import type { TagItem } from '../../types/settings';

interface TagChipProps {
  tag: TagItem;
  className?: string;
}

export function TagChip({ tag, className }: TagChipProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-40 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={{ borderColor: `${tag.color}66`, backgroundColor: `${tag.color}1a` }}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}
