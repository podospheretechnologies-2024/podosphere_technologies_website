'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { POST_DRAG_TYPE, readDraggedPost, type DraggedPost } from '../../lib/calendar';

interface CalendarDropZoneProps {
  /** Past slots accept neither drops nor new posts. */
  disabled: boolean;
  label: string;
  onDropPost: (post: DraggedPost) => void;
  onCreate: () => void;
  className?: string;
  children?: ReactNode;
}

// A calendar slot: drop a post here to reschedule it, or click the empty
// space to create a new post at this time.
export function CalendarDropZone({
  disabled,
  label,
  onDropPost,
  onCreate,
  className,
  children,
}: CalendarDropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      aria-label={label}
      aria-disabled={disabled}
      onDragOver={(event) => {
        if (disabled || !event.dataTransfer.types.includes(POST_DRAG_TYPE)) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setIsOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const post = readDraggedPost(event.dataTransfer);
        if (post && !disabled) {
          onDropPost(post);
        }
      }}
      onClick={(event) => {
        if (!disabled && event.target === event.currentTarget) {
          onCreate();
        }
      }}
      className={cn(
        'transition-colors',
        disabled ? 'bg-surface-muted/40' : 'hover:bg-primary/5 cursor-pointer',
        isOver && 'bg-primary/15 ring-primary ring-2 ring-inset',
        className
      )}
    >
      {children}
    </div>
  );
}
