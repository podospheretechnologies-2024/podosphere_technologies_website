'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface ApiClientRow {
  id: string;
  name: string;
  tokenPrefix: string;
  status: string;
  permissions: string[];
}

export function ApiClientsPanel() {
  const [clients, setClients] = useState<ApiClientRow[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [name, setName] = useState('Production');
  const [selected, setSelected] = useState<string[]>(['posts:write', 'analytics:read', 'leads:read', 'whatsapp:send']);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    void fetch('/api/social/api-clients')
      .then(async (response) => {
        const payload = (await response.json()) as { clients?: ApiClientRow[]; permissions?: string[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'Could not load API clients');
        setClients(payload.clients ?? []);
        setPermissions(payload.permissions ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    setToken(null);
    const response = await fetch('/api/social/api-clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, permissions: selected }),
    });
    const payload = (await response.json()) as { token?: string; error?: string };
    if (!response.ok || !payload.token) {
      setError(payload.error || 'Could not create the key');
      return;
    }
    setToken(payload.token);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="border-border space-y-3 rounded-2xl border p-4">
        <input className="border-border h-10 w-full rounded-xl border px-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} />
        <div className="flex flex-wrap gap-3 text-sm">
          {permissions.map((permission) => (
            <label key={permission} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(permission)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked ? [...current, permission] : current.filter((item) => item !== permission)
                  )
                }
              />
              {permission}
            </label>
          ))}
        </div>
        <Button type="button" onClick={() => void create()}>Create key</Button>
        {token && <p className="text-sm break-all">Copy this key now. It will not be shown again: {token}</p>}
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
      <ul className="space-y-2 text-sm">
        {clients.map((client) => (
          <li key={client.id} className="border-border flex items-center justify-between rounded-xl border px-3 py-2">
            <span>{client.name} · {client.tokenPrefix}… · {client.status}</span>
            <Button
              type="button"
              variant="danger-ghost"
              onClick={() => {
                void fetch(`/api/social/api-clients/${client.id}`, { method: 'DELETE' }).then(() => load());
              }}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
