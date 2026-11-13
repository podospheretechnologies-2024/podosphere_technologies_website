import type { Metadata } from 'next';
import { GrowthDesk } from '@/modules/social/components/growth/growth-desk';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = { title: 'Growth Desk' };

export default function GrowthPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Growth Desk"
        description="Ads spend and ROAS for every client website; Shopify sales when the store is linked. Tasks, campaign plan, blogs and reports — guides only, never changes the ad account by itself."
      />
      <GrowthDesk />
    </div>
  );
}
