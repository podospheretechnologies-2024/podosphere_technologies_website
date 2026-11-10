import { PortalSalesPanel } from '@/modules/social/components/portal/portal-sales-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';
import { portalSalesService } from '@/modules/social/server/portal/portal-sales.service';

export default async function PortalSalesPage() {
  const ctx = await requirePortalPage('sales');
  const data = await portalSalesService.summary({
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
  });

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalSalesPanel data={data} />
    </PortalShell>
  );
}
