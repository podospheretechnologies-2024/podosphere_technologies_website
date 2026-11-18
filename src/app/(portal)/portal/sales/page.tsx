import { PortalGrowthDesk } from '@/modules/social/components/portal/portal-growth-desk';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';
import { portalGrowthService } from '@/modules/social/server/portal/portal-growth.service';

export default async function PortalSalesPage() {
  const ctx = await requirePortalPage('sales');
  const data = await portalGrowthService.overview({
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
  });

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav} clientName={ctx.clientName}>
      <PortalGrowthDesk initial={data} canAct={ctx.canAct('sales')} />
    </PortalShell>
  );
}
