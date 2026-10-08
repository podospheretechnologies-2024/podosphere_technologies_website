'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface Report {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export function ReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    void fetch('/api/social/reports')
      .then((response) => response.json())
      .then((data: Report[]) => setReports(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/social/reports', { method: 'POST' });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not generate the report');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the report');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button type="button" onClick={() => void generate()} disabled={busy}>{busy ? 'Writing…' : 'Generate monthly report'}</Button>
      {error && <p className="text-danger text-sm">{error}</p>}
      {reports.map((report) => (
        <article key={report.id} className="border-border rounded-2xl border p-4">
          <h2 className="text-sm font-semibold">{report.title}</h2>
          <pre className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{report.body}</pre>
        </article>
      ))}
    </div>
  );
}
