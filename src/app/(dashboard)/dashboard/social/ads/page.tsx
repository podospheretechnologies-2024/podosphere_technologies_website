import type { Metadata } from 'next';
import { AdsDashboard } from '@/modules/social/components/ads/ads-dashboard';
import { AdminsOnlyNotice } from '@/modules/social/components/shell/admins-only-notice';
import { getAccess } from '@/shared/server/access';

export const metadata: Metadata = {
  title: 'Ads',
};

export default async function AdsPage() {
  const { role } = await getAccess();
  if (role === 'MEMBER') {
    return (
      <AdminsOnlyNotice
        title="Ads are admin-only"
        description="Only workspace owners and admins can view ad accounts and campaign performance. Ask an admin if you need access."
      />
    );
  }
  return <AdsDashboard />;
}
