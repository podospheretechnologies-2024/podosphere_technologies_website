'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { useId, useMemo } from 'react';
import { Card } from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/cn';
import type { AnalyticsActivity } from '../../types/analytics';

interface ActivityChartProps {
  start: Dayjs;
  days: number;
  activity: AnalyticsActivity[];
}

interface DayBucket {
  day: Dayjs;
  published: number;
  failed: number;
}

interface Point {
  x: number;
  y: number;
}

const GRID_LINES = 4;

const series = [
  { key: 'published', label: 'Published', color: 'var(--success)' },
  { key: 'failed', label: 'Failed', color: 'var(--danger)' },
] as const;

// Horizontal-tangent cubic curve: smooth, and never dips below zero or above a peak.
function smoothPath(points: Point[]): string {
  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const midX = (previous.x + point.x) / 2;
      return `C ${midX} ${previous.y} ${midX} ${point.y} ${point.x} ${point.y}`;
    })
    .join(' ');
}

export function ActivityChart({ start, days, activity }: ActivityChartProps) {
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');

  const buckets = useMemo(() => {
    const result: DayBucket[] = Array.from({ length: days }, (_, index) => ({
      day: start.add(index, 'day'),
      published: 0,
      failed: 0,
    }));
    for (const item of activity) {
      const bucket = result[dayjs(item.date).startOf('day').diff(start, 'day')];
      if (!bucket) continue;
      if (item.outcome === 'published') bucket.published += 1;
      else bucket.failed += 1;
    }
    return result;
  }, [start, days, activity]);

  const totals = buckets.reduce(
    (sum, bucket) => ({
      published: sum.published + bucket.published,
      failed: sum.failed + bucket.failed,
    }),
    { published: 0, failed: 0 }
  );
  const bestDay = buckets.reduce<DayBucket | null>(
    (best, bucket) => (bucket.published > (best?.published ?? 0) ? bucket : best),
    null
  );

  const peak = Math.max(0, ...buckets.map((bucket) => Math.max(bucket.published, bucket.failed)));
  const step = Math.max(1, Math.ceil(peak / GRID_LINES));
  const axisMax = step * GRID_LINES;
  const ticks = Array.from({ length: GRID_LINES + 1 }, (_, index) => axisMax - index * step);

  const xAt = (index: number) => (days > 1 ? (index / (days - 1)) * 100 : 50);
  const yAt = (value: number) => 100 - (value / axisMax) * 100;

  // Series without posts are hidden; failed is drawn first so published stays on top.
  const visibleSeries = [...series].reverse().filter((item) => totals[item.key] > 0);

  const labelEvery = days > 30 ? 15 : days > 7 ? 5 : 1;
  const labelIndexes = buckets
    .map((_, index) => index)
    .filter(
      (index) =>
        index === days - 1 || (index % labelEvery === 0 && days - 1 - index >= labelEvery / 2)
    );

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Posts per day</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Published and failed posts over the last {days} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {series.map((item) => (
            <div
              key={item.key}
              className="border-border flex items-center gap-2 rounded-lg border px-3 py-1.5"
            >
              <span className="size-2 rounded-full" style={{ background: item.color }} />
              <span className="text-muted-foreground text-xs">{item.label}</span>
              <span className="text-sm font-semibold tabular-nums">{totals[item.key]}</span>
            </div>
          ))}
          <div className="border-border flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span className="text-muted-foreground text-xs">Best day</span>
            <span className="text-sm font-semibold">
              {bestDay ? `${bestDay.day.format('D MMM')} · ${bestDay.published}` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="text-muted-foreground relative h-64 w-6 shrink-0 text-right text-[11px] tabular-nums">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 leading-none"
              style={{ top: `${yAt(tick)}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-64" role="img" aria-label="Posts per day chart">
            {ticks.map((tick) => (
              <div
                key={tick}
                className={cn(
                  'border-border pointer-events-none absolute inset-x-0 border-t',
                  tick === 0 ? 'border-solid' : 'border-dashed'
                )}
                style={{ top: `${yAt(tick)}%` }}
              />
            ))}

            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible"
              aria-hidden
            >
              <defs>
                {series.map((item) => (
                  <linearGradient
                    key={item.key}
                    id={`${gradientId}-${item.key}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0%" style={{ stopColor: item.color, stopOpacity: 0.28 }} />
                    <stop offset="100%" style={{ stopColor: item.color, stopOpacity: 0 }} />
                  </linearGradient>
                ))}
              </defs>
              {visibleSeries.map((item) => {
                const points = buckets.map((bucket, index) => ({
                  x: xAt(index),
                  y: yAt(bucket[item.key]),
                }));
                const line = smoothPath(points);
                return (
                  <g key={item.key}>
                    <path
                      d={`${line} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`}
                      fill={`url(#${gradientId}-${item.key})`}
                    />
                    <path
                      d={line}
                      fill="none"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      style={{ stroke: item.color }}
                    />
                  </g>
                );
              })}
            </svg>

            {totals.published + totals.failed === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="border-border bg-surface text-muted-foreground rounded-full border px-4 py-1.5 text-xs">
                  No posts were published or failed in this period
                </p>
              </div>
            )}

            {buckets.map((bucket, index) => {
              const x = xAt(index);
              const alignRight = x > 70;
              return (
                <div
                  key={bucket.day.valueOf()}
                  className="group absolute inset-y-0 -translate-x-1/2"
                  style={{ left: `${x}%`, width: `${100 / Math.max(days - 1, 1)}%` }}
                >
                  <div className="border-muted-foreground/40 absolute inset-y-0 left-1/2 hidden border-l border-dashed group-hover:block" />
                  {visibleSeries.map((item) => (
                    <span
                      key={item.key}
                      className="border-surface absolute left-1/2 hidden size-3 -translate-1/2 rounded-full border-2 shadow group-hover:block"
                      style={{ top: `${yAt(bucket[item.key])}%`, background: item.color }}
                    />
                  ))}
                  <div
                    className={cn(
                      'border-border bg-surface pointer-events-none absolute top-2 z-10 hidden min-w-36 rounded-lg border px-3 py-2.5 text-xs shadow-lg group-hover:block',
                      alignRight ? 'right-1/2 mr-3' : 'left-1/2 ml-3'
                    )}
                  >
                    <p className="mb-2 font-semibold">{bucket.day.format('ddd, D MMM YYYY')}</p>
                    {series.map((item) => (
                      <p key={item.key} className="flex items-center justify-between gap-4 py-0.5">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: item.color }}
                          />
                          {item.label}
                        </span>
                        <span className="font-semibold tabular-nums">{bucket[item.key]}</span>
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-3 h-4 text-[11px]">
            {labelIndexes.map((index) => {
              const isLast = index === days - 1;
              return (
                <span
                  key={index}
                  className={cn(
                    'absolute whitespace-nowrap',
                    index === 0
                      ? 'translate-x-0'
                      : isLast
                        ? '-translate-x-full'
                        : '-translate-x-1/2',
                    isLast ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}
                  style={{ left: `${xAt(index)}%` }}
                >
                  {isLast ? 'Today' : buckets[index].day.format('D MMM')}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
