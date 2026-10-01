'use client';

import { Code2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { getSectionBackendEndpoints } from '../../config/section-backend';
import {
  loadFullSectionBackend,
  type SectionBackendResult,
} from '../../lib/section-backend.client';

interface SectionBackendPanelProps {
  sectionKey: string | undefined;
  sectionLabel: string;
}

type Row =
  | (Omit<SectionBackendResult, 'status' | 'data' | 'error'> & { status: 'loading' })
  | SectionBackendResult;

export function SectionBackendPanel({ sectionKey, sectionLabel }: SectionBackendPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Row[]>([]);
  const [complete, setComplete] = useState<Record<string, unknown> | null>(null);
  const endpoints = getSectionBackendEndpoints(sectionKey);

  const load = useCallback(async () => {
    if (!sectionKey) {
      return;
    }
    setLoading(true);
    setComplete(null);
    setResults(
      getSectionBackendEndpoints(sectionKey).map((endpoint) => ({
        label: endpoint.label,
        url: endpoint.url,
        status: 'loading' as const,
      }))
    );
    try {
      const payload = await loadFullSectionBackend(sectionKey);
      setResults(payload.endpoints);
      setComplete(payload.complete);
    } catch (error) {
      setResults([
        {
          label: 'Section backend',
          url: sectionKey,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Could not load backend data',
        },
      ]);
      setComplete(null);
    } finally {
      setLoading(false);
    }
  }, [sectionKey]);

  useEffect(() => {
    setOpen(false);
    setResults([]);
    setComplete(null);
  }, [sectionKey]);

  useEffect(() => {
    if (!open || !sectionKey) {
      return;
    }
    void load();
  }, [open, sectionKey, load]);

  if (endpoints.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant={open ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="section-backend-panel"
      >
        <Code2 className="size-3.5" />
        Backend
      </Button>

      {open && (
        <div
          id="section-backend-panel"
          className="border-border bg-surface absolute top-full right-0 z-50 mt-2 w-[min(96vw,48rem)] overflow-hidden rounded-xl border shadow-xl"
        >
          <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{sectionLabel} · Backend</p>
              <p className="text-muted-foreground text-xs">
                Complete live API data for this section
                {loading ? ' · loading…' : complete ? ` · ${results.length} responses` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                title="Refresh"
                className="text-muted-foreground hover:bg-surface-muted hover:text-foreground rounded-md p-1.5 transition disabled:opacity-40"
              >
                <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                className="text-muted-foreground hover:bg-surface-muted hover:text-foreground rounded-md p-1.5 transition"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(80vh,40rem)] space-y-3 overflow-y-auto p-3">
            {complete && (
              <div className="border-primary/30 bg-primary/5 overflow-hidden rounded-lg border">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="text-xs font-semibold">Complete section data</p>
                  <span className="bg-primary/15 text-primary rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                    full
                  </span>
                </div>
                <pre className="border-border max-h-[min(50vh,24rem)] overflow-auto border-t p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                  {JSON.stringify(complete, null, 2)}
                </pre>
              </div>
            )}

            {results.map((result) => (
              <div key={`${result.label}:${result.url}`} className="border-border overflow-hidden rounded-lg border">
                <div className="bg-surface-muted/50 flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <p className="text-xs font-semibold">{result.label}</p>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                      result.status === 'ok' && 'bg-success/15 text-success',
                      result.status === 'error' && 'bg-danger/15 text-danger',
                      result.status === 'loading' && 'bg-primary/15 text-primary'
                    )}
                  >
                    {result.status}
                  </span>
                </div>
                <p className="text-muted-foreground border-border border-b px-3 py-1.5 font-mono text-[11px] break-all">
                  GET {result.url}
                </p>
                <pre className="max-h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                  {result.status === 'loading'
                    ? 'Loading…'
                    : result.status === 'error'
                      ? result.error
                      : JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
