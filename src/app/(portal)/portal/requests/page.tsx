import { PortalRequestsPanel } from '@/modules/social/components/portal/portal-requests-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';
import { portalRequestsService } from '@/modules/social/server/portal/portal-requests.service';

export default async function PortalRequestsPage() {
  const ctx = await requirePortalPage('requests');
  const requests = await portalRequestsService.listForPortal({
    approverId: ctx.approverId,
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
    mustChangePassword: false,
  });

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalRequestsPanel initialRequests={requests} />
    </PortalShell>
  );
}
