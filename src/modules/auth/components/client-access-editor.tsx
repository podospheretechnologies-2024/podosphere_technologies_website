'use client';

import { useMemo, useState } from 'react';
import {
  CLIENT_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  type ClientAccessEntry,
  type ClientPermissionId,
} from '../config/client-permissions';

export interface TeamClientOption {
  id: string;
  name: string;
}

/**
 * Pick which clients a MEMBER sees, and what they may do on each. Controlled: the parent owns
 * `value` and saves it (Team page row) or sends it with the invite.
 */
export function ClientAccessEditor({
  clients,
  value,
  onChange,
}: {
  clients: TeamClientOption[];
  value: ClientAccessEntry[];
  onChange: (next: ClientAccessEntry[]) => void;
}) {
  const [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(value.map((entry) => [entry.customerId, entry])), [value]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  function toggleClient(id: string) {
    if (byId.has(id)) onChange(value.filter((entry) => entry.customerId !== id));
    else onChange([...value, { customerId: id, permissions: [...DEFAULT_MEMBER_PERMISSIONS] }]);
  }

  function togglePermission(id: string, permission: ClientPermissionId) {
    onChange(
      value.flatMap((entry) => {
        if (entry.customerId !== id) return [entry];
        const has = entry.permissions.includes(permission);
        const permissions = has ? entry.permissions.filter((p) => p !== permission) : [...entry.permissions, permission];
        // Removing the last permission removes the client.
        return permissions.length > 0 ? [{ ...entry, permissions }] : [];
      })
    );
  }

  if (clients.length === 0) {
    return <p className="text-sm text-gray-500">No clients yet. Create clients on the Clients page first.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients"
          className="h-8 min-w-[180px] flex-1 rounded-md border border-gray-300 px-2 text-sm outline-none focus:border-gray-900"
        />
        <span className="text-xs text-gray-500">
          {value.length} of {clients.length} clients
        </span>
        <button type="button" onClick={() => onChange(clients.map((c) => byId.get(c.id) ?? { customerId: c.id, permissions: [...DEFAULT_MEMBER_PERMISSIONS] }))} className="text-xs text-gray-600 underline">
          All
        </button>
        <button type="button" onClick={() => onChange([])} className="text-xs text-gray-600 underline">
          None
        </button>
      </div>
      <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
        {visible.map((client) => {
          const entry = byId.get(client.id);
          return (
            <li key={client.id} className="px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-900">
                <input type="checkbox" checked={Boolean(entry)} onChange={() => toggleClient(client.id)} />
                {client.name}
              </label>
              {entry && (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                  {CLIENT_PERMISSIONS.map((permission) => {
                    const on = entry.permissions.includes(permission.id);
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePermission(client.id, permission.id)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
                      >
                        {permission.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
