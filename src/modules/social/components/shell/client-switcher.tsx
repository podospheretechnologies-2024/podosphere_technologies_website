'use client';

import { ChevronDown, Users } from 'lucide-react';
import { useClientScope } from '../../hooks/use-client-scope';
import { useWorkspaceRole } from './workspace-role-context';

export function ClientSwitcher() {
  const { selectedClientId, clients, setSelectedClientId, isLoading } = useClientScope();
  const { role } = useWorkspaceRole();
  const allowAllClients = role === 'OWNER' || role === 'ADMIN';
  const lockedClient =
    !allowAllClients && clients.length === 1
      ? clients[0]
      : clients.find((client) => client.id === selectedClientId) ?? null;

  if (!allowAllClients && clients.length <= 1) {
    return (
      <div
        className="border-border bg-surface-muted/60 inline-flex h-8 max-w-[14rem] items-center gap-1.5 rounded-md border px-2 text-xs font-medium"
        title="Your client"
      >
        <Users className="text-muted-foreground size-3.5 shrink-0" />
        <span className="truncate">{lockedClient?.name ?? 'No client assigned'}</span>
      </div>
    );
  }

  return (
    <label className="border-border bg-surface-muted/60 relative inline-flex h-8 max-w-[14rem] items-center gap-1.5 rounded-md border px-2 text-xs font-medium">
      <Users className="text-muted-foreground size-3.5 shrink-0" />
      <select
        aria-label="Client"
        disabled={isLoading}
        value={selectedClientId ?? ''}
        onChange={(event) => {
          const value = event.target.value;
          void setSelectedClientId(value.length > 0 ? value : null);
        }}
        className="text-foreground max-w-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-4 outline-none disabled:opacity-60"
      >
        {allowAllClients ? (
          <option value="">All clients</option>
        ) : !selectedClientId ? (
          <option value="" disabled>
            Select a client
          </option>
        ) : null}
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2 size-3.5" />
    </label>
  );
}
