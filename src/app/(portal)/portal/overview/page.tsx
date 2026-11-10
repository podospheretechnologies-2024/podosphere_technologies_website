import { PortalOverviewPanel } from '@/modules/social/components/portal/portal-overview-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalOverviewPage() {
  const ctx = await requirePortalPage('overview');
  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalOverviewPanel organizationId={ctx.organizationId} customerId={ctx.customerId} />
    </PortalShell>
  );
}
