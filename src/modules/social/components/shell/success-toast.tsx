'use client';

import { Check } from 'lucide-react';

export function SuccessToast({ message = 'Added successfully' }: { message?: string }) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed top-6 left-1/2 z-50 -translate-x-1/2"
    >
      <div className="border-success/40 bg-surface text-foreground flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg shadow-green-500/10">
        <span className="bg-success/15 text-success flex size-6 items-center justify-center rounded-full">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        {message}
      </div>
    </div>
  );
}
