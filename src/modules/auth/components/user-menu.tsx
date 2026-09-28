'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/shared/lib/fetcher';

interface UserMenuProps {
  name: string;
  organizationName: string;
}

export function UserMenu({ name, organizationName }: UserMenuProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 px-2">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-muted-foreground truncate text-xs">{organizationName}</p>
      </div>
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        title="Log out"
        className="text-muted-foreground hover:bg-surface-muted hover:text-foreground rounded-lg p-2 transition"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
