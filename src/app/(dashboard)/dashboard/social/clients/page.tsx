'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Link as LinkIcon, Copy, Check } from 'lucide-react';
import { apiFetch } from '@/shared/lib/fetcher';

export default function ClientsPage() {
  const { data: clients, mutate } = useSWR<any[]>('/api/social/clients', apiFetch);
  const { data: adAccounts } = useSWR<any[]>('/api/social/ads/accounts', apiFetch);
  const [isAdding, setIsAdding] = useState(false);
  
  const [form, setForm] = useState({ name: '', approverName: '', approverEmail: '', adAccountId: '' });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch('/api/social/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setForm({ name: '', approverName: '', approverEmail: '', adAccountId: '' });
    setIsAdding(false);
    mutate();
  }

  async function generateLink(clientId: string) {
    const res = (await apiFetch(`/api/social/clients/${clientId}/magic-link`, { method: 'POST' })) as any;
    await navigator.clipboard.writeText(res.magicLink);
    setCopiedId(clientId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Client Management</h1>
          <p className="text-muted-foreground mt-1">Manage your agency clients and approval portals.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition"
        >
          <Plus className="size-4" /> Add Client
        </button>
      </div>

      {isAdding && (
        <div className="bg-surface-muted rounded-xl border p-6">
          <h3 className="text-lg font-medium mb-4">Add New Client</h3>
          <form onSubmit={handleAddClient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Agency Client Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Podosphere Technologies"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Link Ad Account (Optional)</label>
                <select
                  value={form.adAccountId}
                  onChange={(e) => setForm({ ...form, adAccountId: e.target.value })}
                  className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">-- None --</option>
                  {adAccounts?.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Approver Name</label>
                <input
                  type="text"
                  required
                  value={form.approverName}
                  onChange={(e) => setForm({ ...form, approverName: e.target.value })}
                  className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. Sushant"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Approver Email</label>
                <input
                  type="email"
                  required
                  value={form.approverEmail}
                  onChange={(e) => setForm({ ...form, approverEmail: e.target.value })}
                  className="bg-surface border-border flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g. sushant@example.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition"
              >
                Create Client
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-surface rounded-xl border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted/50 border-b text-xs uppercase">
            <tr>
              <th className="px-6 py-4 font-medium text-muted-foreground">Client Name</th>
              <th className="px-6 py-4 font-medium text-muted-foreground">Approver</th>
              <th className="px-6 py-4 font-medium text-muted-foreground">Linked Ads</th>
              <th className="px-6 py-4 font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!clients ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No clients added yet.</td></tr>
            ) : (
              clients.map((client: any) => (
                <tr key={client.id} className="hover:bg-surface-muted/30 transition">
                  <td className="px-6 py-4 font-medium">{client.name}</td>
                  <td className="px-6 py-4">
                    {client.approvers?.[0]?.name} <br/>
                    <span className="text-muted-foreground text-xs">{client.approvers?.[0]?.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    {client.adAccounts?.length ? (
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                        {client.adAccounts[0].name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unlinked</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => generateLink(client.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-surface-muted transition"
                    >
                      {copiedId === client.id ? (
                        <><Check className="size-3.5 text-green-500" /> Copied!</>
                      ) : (
                        <><LinkIcon className="size-3.5" /> Copy Magic Link</>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
