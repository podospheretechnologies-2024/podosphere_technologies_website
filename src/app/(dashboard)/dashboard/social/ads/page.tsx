import type { Metadata } from 'next';
import { AdsDashboard } from '@/modules/social/components/ads/ads-dashboard';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Ads',
};

export default function AdsPage() {
  const { label, description } = socialSections.ads;

  return (
    <>
      <PageHeader title={label} description={description} />
      <AdsDashboard />
    </>
  );
}
