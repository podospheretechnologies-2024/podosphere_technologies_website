import type { Metadata } from 'next';
import { ReportsPanel } from '@/modules/social/components/reports/reports-panel';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Client reports" description="Monthly summaries from published posts, leads and inbox activity." />
      <ReportsPanel />
    </div>
  );
}
