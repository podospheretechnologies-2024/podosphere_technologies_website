import { PortalLeadsPanel } from '@/modules/social/components/portal/portal-leads-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { portalLeadsService } from '@/modules/social/server/portal/portal-leads.service';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalLeadsPage() {
  const ctx = await requirePortalPage('leads');
  const data = await portalLeadsService.list({
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
  });

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalLeadsPanel data={data} />
    </PortalShell>
  );
}
