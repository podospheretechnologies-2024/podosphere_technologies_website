'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useClientScopeKey } from '../../hooks/use-client-scope';

interface Report {
  id: string;
  title: string;
  body: string;
  narrative?: string | null;
  pdfUrl: string | null;
  createdAt: string;
  periodStart?: string;
  periodEnd?: string;
}

export function ReportsPanel() {
  const scopeKey = useClientScopeKey();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queuedHint, setQueuedHint] = useState<string | null>(null);

  function load() {
    void fetch('/api/social/reports')
      .then((response) => response.json())
      .then((data: Report[]) => setReports(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    load();
  }, [scopeKey]);

  useEffect(() => {
    if (!queuedHint) return;
    const timer = window.setInterval(() => load(), 3000);
    const stop = window.setTimeout(() => {
      window.clearInterval(timer);
      setQueuedHint(null);
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [queuedHint]);

  async function generatePdf() {
    setBusy(true);
    setError(null);
    setQueuedHint(null);
    try {
      const response = await fetch('/api/social/reports', { method: 'POST' });
      const payload = (await response.json()) as {
        error?: string;
        queued?: number;
        periodStart?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Could not queue the PDF report');
      setQueuedHint(
        payload.queued === 1
          ? 'PDF report queued — download link appears when ready.'
          : `${payload.queued ?? 0} PDF reports queued — download links appear when ready.`
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue the PDF report');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" onClick={() => void generatePdf()} disabled={busy}>
        {busy ? 'Queueing…' : 'Generate PDF report'}
      </Button>
      {queuedHint && <p className="text-muted-foreground text-sm">{queuedHint}</p>}
      {error && <p className="text-danger text-sm">{error}</p>}
      {reports.map((report) => (
        <article key={report.id} className="border-border rounded-2xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-sm font-semibold">{report.title}</h2>
            {report.pdfUrl ? (
              <a
                href={report.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium underline underline-offset-2"
              >
                Download PDF
              </a>
            ) : (
              <span className="text-muted-foreground text-xs">No PDF yet</span>
            )}
          </div>
          {report.narrative && (
            <div className="border-border mt-3 rounded-xl border border-dashed p-3">
              <p className="text-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                AI narrative
              </p>
              <pre className="text-muted-foreground text-sm whitespace-pre-wrap">{report.narrative}</pre>
            </div>
          )}
          <pre className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{report.body}</pre>
        </article>
      ))}
    </div>
  );
}
