import { PortalAdsPanel } from '@/modules/social/components/portal/portal-ads-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalAdsPage() {
  const ctx = await requirePortalPage('ads');
  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalAdsPanel organizationId={ctx.organizationId} customerId={ctx.customerId} />
    </PortalShell>
  );
}
