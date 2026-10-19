'use client';

import { useMemo } from 'react';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import { useBestTimes } from '../../hooks/use-best-times';
import type { BestTimesCell } from '../../types/analytics';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
/** Show daytime + evening hours that agencies typically care about. */
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;

interface BestTimesHeatmapProps {
  integrationId: string | null;
}

function cellKey(weekday: number, hour: number) {
  return `${weekday}:${hour}`;
}

function scoreColor(score: number, peak: number): string {
  if (peak <= 0 || score <= 0) return 'bg-surface-muted/40';
  const t = Math.min(1, score / peak);
  if (t < 0.25) return 'bg-primary/15';
  if (t < 0.5) return 'bg-primary/35';
  if (t < 0.75) return 'bg-primary/55';
  return 'bg-primary/80';
}

function formatHour(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour < 12 ? 'a' : 'p'}`;
}

export function BestTimesHeatmap({ integrationId }: BestTimesHeatmapProps) {
  const { data, error, isLoading } = useBestTimes(integrationId);

  const bySlot = useMemo(() => {
    const map = new Map<string, BestTimesCell>();
    for (const cell of data?.cells ?? []) {
      map.set(cellKey(cell.weekday, cell.hour), cell);
    }
    return map;
  }, [data]);

  const peak = useMemo(() => {
    let max = 0;
    for (const hour of HOURS) {
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const cell = bySlot.get(cellKey(weekday, hour));
        if (cell && cell.postCount > 0) max = Math.max(max, cell.avgScore);
      }
    }
    return max;
  }, [bySlot]);

  if (!integrationId || integrationId === 'all') {
    return (
      <Card className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold">Best time to post</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Pick a channel above to see when likes, comments, and reach peak.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Best time to post</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Average likes + comments + reach by weekday and hour
            {data ? ` · ${data.timeZone} · last ${data.lookbackDays} days` : ''}.
          </p>
        </div>
        {data?.suggested[0] ? (
          <p className="text-foreground text-sm font-medium tabular-nums">
            Top: {data.suggested[0].label}
            <span className="text-muted-foreground ml-1.5 text-xs font-normal">
              (avg {Math.round(data.suggested[0].avgScore)})
            </span>
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load best times.'}
        </p>
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading heatmap…</p>
      ) : !data || data.postCount === 0 ? (
        <p className="text-muted-foreground text-sm">
          No synced post history for this channel yet. Run Sync Live to pull Meta posts.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div
              className="inline-grid min-w-full gap-1"
              style={{ gridTemplateColumns: `2.5rem repeat(${HOURS.length}, minmax(1.5rem, 1fr))` }}
              role="img"
              aria-label="Best times heatmap"
            >
              <div />
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="text-muted-foreground text-center text-[10px] font-medium tabular-nums"
                >
                  {formatHour(hour)}
                </div>
              ))}
              {WEEKDAYS.map((label, weekday) => (
                <div key={label} className="contents">
                  <div className="text-muted-foreground flex items-center text-[11px] font-medium">
                    {label}
                  </div>
                  {HOURS.map((hour) => {
                    const cell = bySlot.get(cellKey(weekday, hour));
                    const score = cell?.avgScore ?? 0;
                    const count = cell?.postCount ?? 0;
                    return (
                      <div
                        key={`${weekday}-${hour}`}
                        title={
                          count > 0
                            ? `${label} ${formatHour(hour)} · avg ${Math.round(score)} · ${count} posts`
                            : `${label} ${formatHour(hour)} · no posts`
                        }
                        className={cn(
                          'aspect-square min-h-6 rounded-sm',
                          scoreColor(score, peak),
                          count === 0 && 'opacity-40'
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {data.suggested.length > 0 ? (
            <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {data.suggested.map((slot, index) => (
                <li key={`${slot.weekday}-${slot.hour}`}>
                  <span className="text-foreground font-medium">#{index + 1}</span> {slot.label}
                  <span className="ml-1 tabular-nums">· avg {Math.round(slot.avgScore)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              Need at least two posts in the same slot before ranking suggestions.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
