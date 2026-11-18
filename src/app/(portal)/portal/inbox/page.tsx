import { PortalInboxPanel } from '@/modules/social/components/portal/portal-inbox-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { portalInboxService } from '@/modules/social/server/portal/portal-inbox.service';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalInboxPage() {
  const ctx = await requirePortalPage('inbox');
  const data = await portalInboxService.listThreads({
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
  });

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav} clientName={ctx.clientName}>
      <PortalInboxPanel data={data} canAct={ctx.canAct('inbox')} />
    </PortalShell>
  );
}
