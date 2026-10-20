import type { Metadata } from 'next';
import { AdsDashboard } from '@/modules/social/components/ads/ads-dashboard';
import { AdminsOnlyNotice } from '@/modules/social/components/shell/admins-only-notice';
import { getCurrentUser } from '@/modules/auth/server/session';
import { getAccess } from '@/shared/server/access';

export const metadata: Metadata = {
  title: 'Ads',
};

export default async function AdsPage() {
  const { role } = await getAccess();
  // Real session user, so sample tabs stay visible while a platform admin impersonates a workspace.
  const isPlatformAdmin = (await getCurrentUser())?.isPlatformAdmin ?? false;
  if (role === 'MEMBER') {
    return (
      <AdminsOnlyNotice
        title="Ads are admin-only"
        description="Only workspace owners and admins can view ad accounts and campaign performance. Ask an admin if you need access."
      />
    );
  }
  return <AdsDashboard isPlatformAdmin={isPlatformAdmin} />;
}
