import { PortalAgentPanel } from '@/modules/social/components/portal/portal-agent-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { portalAgentService } from '@/modules/social/server/portal/portal-agent.service';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalAgentPage() {
  const ctx = await requirePortalPage('agent');
  const session = {
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
  };
  const [status, provider] = await Promise.all([
    portalAgentService.status(session),
    portalAgentService.getProvider(session),
  ]);
  const threads = status.configured ? await portalAgentService.listThreads(session) : [];

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav} clientName={ctx.clientName}>
      <PortalAgentPanel
        configured={status.configured}
        provider={provider}
        initialThreads={threads}
        canAct={ctx.canAct('agent')}
      />
    </PortalShell>
  );
}
