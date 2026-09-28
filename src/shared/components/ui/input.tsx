import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'border-border bg-surface text-foreground placeholder:text-muted-foreground focus:border-primary h-10 w-full rounded-lg border px-3 text-sm transition outline-none',
        className
      )}
      {...props}
    />
  );
}
