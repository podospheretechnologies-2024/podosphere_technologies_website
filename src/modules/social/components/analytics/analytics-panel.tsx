'use client';

import dayjs from 'dayjs';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Input } from '@/shared/components/ui/input';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import { cn } from '@/shared/lib/cn';
import {
  ANALYTICS_DEFAULT_RANGE,
  ANALYTICS_MAX_RANGE_DAYS,
  ANALYTICS_RANGE_OPTIONS,
  type AnalyticsRange,
} from '../../config/analytics';
import { useAnalytics } from '../../hooks/use-analytics';
import { downloadAnalyticsReport } from '../../lib/analytics-download';
import type { AnalyticsActivity } from '../../types/analytics';
import { ActivityChart } from './activity-chart';
import { ChannelBreakdown } from './channel-breakdown';
import { PostPerformance } from './post-performance';
import { PostTimeline } from './post-timeline';

interface SparklineCardProps {
  label: string;
  value: string | number;
  series: number[];
  accent?: 'primary' | 'success' | 'danger' | 'muted';
}

function SparklineCard({ label, value, series, accent = 'primary' }: SparklineCardProps) {
  const peak = Math.max(1, ...series);
  const width = 100;
  const height = 48;
  const points = series.map((entry, index) => {
    const x = series.length <= 1 ? width / 2 : (index / (series.length - 1)) * width;
    const y = height - (entry / peak) * (height - 4) - 2;
    return { x, y };
  });
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  const area =
    points.length > 0
      ? `${line} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`
      : '';

  const fill =
    accent === 'success'
      ? 'var(--success)'
      : accent === 'danger'
        ? 'var(--danger)'
        : accent === 'muted'
          ? 'var(--muted-foreground)'
          : 'var(--primary)';

  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="relative h-12 w-full" role="img" aria-label={`${label} trend`}>
        <svg viewBox={`0 0 ${width} ${height}`} className="size-full overflow-visible" aria-hidden>
          {area && <path d={area} fill={fill} opacity={0.85} />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={1.6}
              fill="white"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <p
        className={cn(
          'text-2xl font-semibold tabular-nums',
          accent === 'success' && 'text-success',
          accent === 'danger' && 'text-danger',
          accent === 'primary' && 'text-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function dailySeries(
  start: dayjs.Dayjs,
  days: number,
  activity: AnalyticsActivity[],
  outcome: AnalyticsActivity['outcome'] | 'all'
): number[] {
  const buckets = Array.from({ length: days }, () => 0);
  for (const item of activity) {
    const index = dayjs(item.date).startOf('day').diff(start, 'day');
    if (index < 0 || index >= days) continue;
    if (outcome === 'all' || item.outcome === outcome) {
      buckets[index] += 1;
    }
  }
  return buckets;
}

export function AnalyticsPanel() {
  const [rangeValue, setRangeValue] = useState<AnalyticsRange>(ANALYTICS_DEFAULT_RANGE);
  const [customStart, setCustomStart] = useState(() =>
    dayjs().subtract(29, 'day').format('YYYY-MM-DD')
  );
  const [customEnd, setCustomEnd] = useState(() => dayjs().format('YYYY-MM-DD'));

  const range = useMemo(() => {
    const endExclusive = dayjs().add(1, 'day').startOf('day');
    if (rangeValue === 'custom') {
      let start = dayjs(customStart).startOf('day');
      let end = dayjs(customEnd).add(1, 'day').startOf('day');
      if (!start.isValid()) start = endExclusive.subtract(30, 'day');
      if (!end.isValid() || !end.isAfter(start)) end = start.add(1, 'day');
      const maxEnd = start.add(ANALYTICS_MAX_RANGE_DAYS, 'day');
      if (end.isAfter(maxEnd)) end = maxEnd;
      return { start, end };
    }
    const days = Number(rangeValue);
    return { start: endExclusive.subtract(days, 'day'), end: endExclusive };
  }, [rangeValue, customStart, customEnd]);

  const days = Math.max(1, range.end.diff(range.start, 'day'));
  const { data, error, isLoading, mutate } = useAnalytics(range);

  const publishedSeries = useMemo(
    () => (data ? dailySeries(range.start, days, data.activity, 'published') : []),
    [data, range.start, days]
  );
  const failedSeries = useMemo(
    () => (data ? dailySeries(range.start, days, data.activity, 'error') : []),
    [data, range.start, days]
  );
  const allSeries = useMemo(
    () => (data ? dailySeries(range.start, days, data.activity, 'all') : []),
    [data, range.start, days]
  );
  const successSeries = useMemo(
    () =>
      publishedSeries.map((published, index) => {
        const total = published + failedSeries[index];
        return total === 0 ? 0 : Math.round((published / total) * 100);
      }),
    [publishedSeries, failedSeries]
  );

  const customInvalid =
    rangeValue === 'custom' &&
    (!dayjs(customStart).isValid() ||
      !dayjs(customEnd).isValid() ||
      !dayjs(customEnd).startOf('day').isAfter(dayjs(customStart).startOf('day').subtract(1, 'day')) ||
      dayjs(customEnd).startOf('day').diff(dayjs(customStart).startOf('day'), 'day') + 1 >
        ANALYTICS_MAX_RANGE_DAYS);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-3">
          <SegmentedControl
            label="Date range"
            options={ANALYTICS_RANGE_OPTIONS}
            value={rangeValue}
            onChange={setRangeValue}
          />
          {rangeValue === 'custom' && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground font-medium">From</span>
                <Input
                  type="date"
                  value={customStart}
                  max={customEnd}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="h-9 w-auto"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground font-medium">To</span>
                <Input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={dayjs().format('YYYY-MM-DD')}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="h-9 w-auto"
                />
              </label>
              {customInvalid && (
                <p className="text-danger text-xs">
                  Pick a valid range up to {ANALYTICS_MAX_RANGE_DAYS} days.
                </p>
              )}
            </div>
          )}
        </div>

        <Button
          variant="secondary"
          disabled={!data || isLoading}
          onClick={() => data && downloadAnalyticsReport(data, range)}
        >
          <Download className="size-4" />
          Download report
        </Button>
      </div>

      {error && !data ? (
        <EmptyState
          title="Could not load analytics"
          description={error instanceof Error ? error.message : undefined}
          action={<Button onClick={() => mutate()}>Try again</Button>}
        />
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading analytics…</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SparklineCard
              label="Posts Published"
              value={data.totals.published}
              series={publishedSeries}
              accent="primary"
            />
            <SparklineCard
              label="Success Rate"
              value={data.successRate === null ? '—' : `${data.successRate}%`}
              series={successSeries.length ? successSeries : [0]}
              accent="success"
            />
            <SparklineCard
              label="Failed Posts"
              value={data.totals.failed}
              series={failedSeries}
              accent="danger"
            />
            <SparklineCard
              label="Scheduled"
              value={data.totals.scheduled}
              series={allSeries}
              accent="primary"
            />
            <SparklineCard
              label="Drafts"
              value={data.totals.drafts}
              series={allSeries.map((value) => Math.max(0, value))}
              accent="muted"
            />
            <SparklineCard
              label="Total Activity"
              value={data.totals.published + data.totals.failed}
              series={allSeries}
              accent="primary"
            />
          </div>

          <ActivityChart start={range.start} days={days} activity={data.activity} />

          <ChannelBreakdown channels={data.channels} />

          <PostTimeline posts={data.posts} />

          <PostPerformance posts={data.posts} />
        </>
      ) : null}
    </div>
  );
}
