import type { Metadata } from 'next';
import { LeadsPanel } from '@/modules/social/components/inbox/leads-panel';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = { title: 'Leads' };

export default function LeadsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Leads" description="Lead-form submissions captured from the Page webhook." />
      <LeadsPanel />
    </div>
  );
}
