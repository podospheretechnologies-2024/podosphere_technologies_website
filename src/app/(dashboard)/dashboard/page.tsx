import type { Metadata } from 'next';
import Link from 'next/link';
import { socialNavigation } from '@/modules/social/config/navigation';
import { Card } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything you manage at Podosphere Technologies."
      />
      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
          {socialNavigation.title}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {socialNavigation.items.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:border-primary h-full transition">
                <h3 className="font-semibold">{item.label}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
