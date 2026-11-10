import type { Metadata } from 'next';
import { GrowthDesk } from '@/modules/social/components/growth/growth-desk';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = { title: 'Growth Desk' };

export default function GrowthPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Growth Desk"
        description="Shopify sales vs Meta spend, daily tasks with review, ad and blog approvals, content tracker and reports — per client. It only guides: nothing changes in the ad account by itself."
      />
      <GrowthDesk />
    </div>
  );
}
