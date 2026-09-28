import Link from 'next/link';
import type { ReactNode } from 'react';
import type { NavSection } from '@/shared/types/navigation';
import { NavLink } from './nav-link';

interface DashboardShellProps {
  sections: NavSection[];
  children: ReactNode;
  /** Rendered at the bottom of the sidebar (e.g. the signed-in user). */
  footer?: ReactNode;
}

export function DashboardShell({ sections, children, footer }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="border-border bg-surface hidden w-64 shrink-0 flex-col border-r md:flex">
        <Link href="/dashboard" className="flex h-16 items-center gap-2 px-6 font-semibold">
          <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm">
            P
          </span>
          Podosphere
        </Link>
        <nav className="flex-1 space-y-6 px-3 py-4">
          <NavLink href="/dashboard" label="Overview" exact />
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-muted-foreground px-3 pb-2 text-xs font-semibold tracking-wide uppercase">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        {footer && <div className="border-border border-t p-3">{footer}</div>}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-surface flex h-16 items-center border-b px-6 md:hidden">
          <Link href="/dashboard" className="font-semibold">
            Podosphere
          </Link>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
