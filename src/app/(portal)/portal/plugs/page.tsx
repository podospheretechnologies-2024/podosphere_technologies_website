import { PortalPlugsPanel } from '@/modules/social/components/portal/portal-plugs-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { portalPlugsService } from '@/modules/social/server/portal/portal-plugs.service';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalPlugsPage() {
  const ctx = await requirePortalPage('plugs');
  const data = await portalPlugsService.list({
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
  });

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav} clientName={ctx.clientName}>
      <PortalPlugsPanel data={data} />
    </PortalShell>
  );
}
