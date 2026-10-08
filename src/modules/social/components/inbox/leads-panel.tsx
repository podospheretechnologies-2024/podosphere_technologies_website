'use client';

import { useEffect, useState } from 'react';

interface Lead {
  id: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

export function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/social/leads')
      .then(async (response) => {
        const payload = (await response.json()) as Lead[] | { error?: string };
        if (!response.ok) throw new Error('error' in payload ? payload.error : 'Could not load leads');
        setLeads(payload as Lead[]);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="border-border overflow-hidden rounded-2xl border">
      {error && <p className="text-danger p-4 text-sm">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-muted-foreground text-xs">
          <tr>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Phone</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-border border-t">
              <td className="px-3 py-2">{lead.source}</td>
              <td className="px-3 py-2">{lead.name || '—'}</td>
              <td className="px-3 py-2">{lead.email || '—'}</td>
              <td className="px-3 py-2">{lead.phone || '—'}</td>
            </tr>
          ))}
          {leads.length === 0 && !error && (
            <tr><td className="text-muted-foreground px-3 py-6" colSpan={4}>Lead-form webhooks will show up here.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
