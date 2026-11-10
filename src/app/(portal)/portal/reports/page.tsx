import { PortalReportsPanel } from '@/modules/social/components/portal/portal-reports-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalReportsPage() {
  const ctx = await requirePortalPage('reports');
  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalReportsPanel organizationId={ctx.organizationId} customerId={ctx.customerId} />
    </PortalShell>
  );
}
