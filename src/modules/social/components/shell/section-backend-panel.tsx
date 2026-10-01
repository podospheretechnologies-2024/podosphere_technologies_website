'use client';

import { Code2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { apiFetch } from '@/shared/lib/fetcher';
import {
  getSectionBackendEndpoints,
  type SectionBackendEndpoint,
} from '../../config/section-backend';

interface SectionBackendPanelProps {
  sectionKey: string | undefined;
  sectionLabel: string;
}

interface EndpointResult {
  label: string;
  url: string;
  status: 'idle' | 'loading' | 'ok' | 'error';
  data?: unknown;
  error?: string;
}

export function SectionBackendPanel({ sectionKey, sectionLabel }: SectionBackendPanelProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EndpointResult[]>([]);
  const endpoints = getSectionBackendEndpoints(sectionKey);

  const load = useCallback(async (list: SectionBackendEndpoint[]) => {
    setResults(
      list.map((endpoint) => ({
        label: endpoint.label,
        url: endpoint.url,
        status: 'loading',
      }))
    );

    const next = await Promise.all(
      list.map(async (endpoint) => {
        try {
          const data = await apiFetch<unknown>(endpoint.url);
          return {
            label: endpoint.label,
            url: endpoint.url,
            status: 'ok' as const,
            data,
          };
        } catch (error) {
          return {
            label: endpoint.label,
            url: endpoint.url,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Request failed',
          };
        }
      })
    );
    setResults(next);
  }, []);

  useEffect(() => {
    setOpen(false);
    setResults([]);
  }, [sectionKey]);

  useEffect(() => {
    if (!open || !sectionKey) {
      return;
    }
    const list = getSectionBackendEndpoints(sectionKey);
    if (list.length === 0) {
      return;
    }
    void load(list);
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
          className="border-border bg-surface absolute top-full right-0 z-50 mt-2 w-[min(92vw,40rem)] overflow-hidden rounded-xl border shadow-xl"
        >
          <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{sectionLabel} · Backend</p>
              <p className="text-muted-foreground text-xs">
                Live API responses for this section
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void load(getSectionBackendEndpoints(sectionKey))}
                title="Refresh"
                className="text-muted-foreground hover:bg-surface-muted hover:text-foreground rounded-md p-1.5 transition"
              >
                <RefreshCw className="size-3.5" />
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

          <div className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto p-3">
            {results.map((result) => (
              <div key={result.url} className="border-border overflow-hidden rounded-lg border">
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
                <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
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
