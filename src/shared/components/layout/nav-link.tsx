'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/cn';

interface NavLinkProps {
  href: string;
  label: string;
  exact?: boolean;
  variant?: 'sidebar' | 'tab';
}

export function NavLink({ href, label, exact = false, variant = 'sidebar' }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'text-sm font-medium transition',
        variant === 'sidebar' && 'block rounded-lg px-3 py-2',
        variant === 'sidebar' &&
          (isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'),
        variant === 'tab' && 'border-b-2 px-1 pb-3 whitespace-nowrap',
        variant === 'tab' &&
          (isActive
            ? 'border-primary text-foreground'
            : 'text-muted-foreground hover:text-foreground border-transparent')
      )}
    >
      {label}
    </Link>
  );
}
