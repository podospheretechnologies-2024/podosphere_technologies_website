'use client';

import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/shared/lib/cn';
import {
  formatOccasionDate,
  getUpcomingOccasions,
  type UpcomingOccasion,
} from '../../config/festival-calendar';

export interface OccasionSeed {
  topic: string;
  tonePresetId: UpcomingOccasion['suggestedTonePresetId'];
  occasionDate: string;
  occasionName: string;
}

interface UpcomingOccasionsProps {
  withinDays?: number;
  onSelect?: (seed: OccasionSeed) => void;
  className?: string;
  /** Shorter copy for narrow sidebars */
  compact?: boolean;
}

export function UpcomingOccasions({
  withinDays = 60,
  onSelect,
  className,
  compact = false,
}: UpcomingOccasionsProps) {
  const occasions = useMemo(() => getUpcomingOccasions(new Date(), withinDays), [withinDays]);
  const interactive = Boolean(onSelect);

  return (
    <aside
      className={cn(
        'border-border bg-surface space-y-3 rounded-xl border p-4',
        className
      )}
    >
      <div className="flex items-start gap-2">
        <CalendarDays className="text-primary mt-0.5 size-4 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">Upcoming occasions</h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {!interactive
              ? 'Upcoming India-relevant dates (view only).'
              : compact
                ? 'Tap to seed a draft topic.'
                : 'India-relevant dates. Click one to seed a post draft topic and matching tone.'}
          </p>
        </div>
      </div>

      {occasions.length === 0 ? (
        <p className="text-muted-foreground text-xs">No occasions in the next {withinDays} days.</p>
      ) : (
        <ul className="space-y-1.5">
          {occasions.map((occasion) => (
            <li key={`${occasion.id}-${occasion.date}`}>
              <button
                type="button"
                disabled={!interactive}
                onClick={() =>
                  onSelect?.({
                    topic: occasion.draftTopic,
                    tonePresetId: occasion.suggestedTonePresetId,
                    occasionDate: occasion.date,
                    occasionName: occasion.name,
                  })
                }
                className={cn(
                  'border-border flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition',
                  interactive
                    ? 'hover:border-primary/40 hover:bg-surface-muted/60'
                    : 'cursor-default opacity-90'
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{occasion.name}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    {occasion.daysUntil === 0
                      ? 'Today'
                      : occasion.daysUntil === 1
                        ? 'Tomorrow'
                        : `${occasion.daysUntil}d`}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatOccasionDate(occasion.date)}
                  {!compact && (
                    <>
                      {' · '}
                      <span className="text-foreground/80">{occasion.suggestedToneLabel}</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
