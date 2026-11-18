import { PortalAgentPanel } from '@/modules/social/components/portal/portal-agent-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { portalAgentService } from '@/modules/social/server/portal/portal-agent.service';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalAgentPage() {
  const ctx = await requirePortalPage('agent');
  const status = portalAgentService.status();
  const threads = status.configured
    ? await portalAgentService.listThreads({
        organizationId: ctx.organizationId,
        customerId: ctx.customerId,
      })
    : [];

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav} clientName={ctx.clientName}>
      <PortalAgentPanel
        configured={status.configured}
        initialThreads={threads}
        canAct={ctx.canAct('agent')}
      />
    </PortalShell>
  );
}
