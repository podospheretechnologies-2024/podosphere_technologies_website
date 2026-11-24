'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useClientScope, useClientScopeKey } from '../../hooks/use-client-scope';

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
  const { clients } = useClientScope();
  const [customerId, setCustomerId] = useState('');
  const [month, setMonth] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queuedHint, setQueuedHint] = useState<string | null>(null);

  function load() {
    const query = new URLSearchParams();
    if (customerId) query.set('customerId', customerId);
    if (month) query.set('month', month);
    const qs = query.toString();
    void fetch(`/api/social/reports${qs ? `?${qs}` : ''}`)
      .then((response) => response.json())
      .then((data: Report[]) => setReports(Array.isArray(data) ? data : []))
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, customerId, month]);

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
      const response = await fetch('/api/social/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || undefined,
          month: month || undefined,
        }),
      });
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="text-muted-foreground mb-1 block font-medium">Client</span>
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="border-border bg-surface h-9 rounded-lg border px-2 text-sm"
          >
            <option value="">Current scope</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground mb-1 block font-medium">Month</span>
          <input
            type="month"
            value={month}
            max={new Date().toISOString().slice(0, 7)}
            onChange={(event) => setMonth(event.target.value)}
            className="border-border bg-surface h-9 rounded-lg border px-2 text-sm"
          />
        </label>
        <Button type="button" onClick={() => void generatePdf()} disabled={busy}>
          {busy ? 'Queueing…' : 'Generate PDF report'}
        </Button>
      </div>
      {loaded && reports.length === 0 && !queuedHint && (
        <p className="text-muted-foreground text-sm">
          No reports yet{customerId || month ? ' for this client and month' : ''}. Pick a client and
          month, then generate one.
        </p>
      )}
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
