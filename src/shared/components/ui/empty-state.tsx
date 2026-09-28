import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="border-border bg-surface flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-2 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
