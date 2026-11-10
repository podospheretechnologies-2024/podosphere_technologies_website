import { PortalAnalyticsPanel } from '@/modules/social/components/portal/portal-analytics-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalAnalyticsPage() {
  const ctx = await requirePortalPage('analytics');
  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalAnalyticsPanel organizationId={ctx.organizationId} customerId={ctx.customerId} />
    </PortalShell>
  );
}
