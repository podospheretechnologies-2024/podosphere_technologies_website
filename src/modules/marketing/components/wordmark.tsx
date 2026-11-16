import Link from 'next/link';
import { cn } from '@/shared/lib/cn';

export function PodoWordmark({
  href = '/',
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2.5 font-semibold tracking-tight', className)}
    >
      <span
        aria-hidden
        className="bg-foreground text-background flex size-8 items-center justify-center rounded-lg text-sm font-bold"
      >
        P
      </span>
      <span className="text-lg">
        Podo <span className="font-medium text-muted-foreground">Social</span>
      </span>
    </Link>
  );
}
