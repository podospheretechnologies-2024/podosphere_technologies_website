import { PortalChannelsPanel } from '@/modules/social/components/portal/portal-channels-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalChannelsPage(props: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await requirePortalPage('channels');
  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalChannelsPanel
        organizationId={ctx.organizationId}
        customerId={ctx.customerId}
        connected={searchParams.connected}
      />
    </PortalShell>
  );
}
