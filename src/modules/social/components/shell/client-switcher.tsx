'use client';

import { ChevronDown, Users } from 'lucide-react';
import { useClientScope } from '../../hooks/use-client-scope';

export function ClientSwitcher() {
  const { selectedClientId, clients, setSelectedClientId, isLoading } = useClientScope();

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
        <option value="">All clients</option>
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
