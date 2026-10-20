import { redirect } from 'next/navigation';
import { MarketplaceAdsDashboard } from '@/modules/admin/components/marketplace-ads-dashboard';
import { padMarketplaceClients } from '@/modules/admin/data/marketplace-ads.sample';
import { adminService } from '@/modules/admin/server/admin.service';
import { getCurrentUser } from '@/modules/auth/server/session';

export const metadata = { title: 'Marketplace Ads | Super Admin' };

function httpStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

export default async function MarketplaceAdsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  if (!user.isPlatformAdmin) redirect('/dashboard');

  let clients;
  try {
    clients = padMarketplaceClients(await adminService.listMarketplaceDemoClients());
  } catch (error) {
    const status = httpStatus(error);
    if (status === 401) redirect('/admin/login');
    if (status === 403 || status === 404) redirect('/dashboard');
    throw error;
  }

  return <MarketplaceAdsDashboard clients={clients} />;
}
