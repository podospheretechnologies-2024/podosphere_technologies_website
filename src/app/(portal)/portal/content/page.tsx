import { PortalContentPanel } from '@/modules/social/components/portal/portal-content-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalContentPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  const ctx = await requirePortalPage('content');
  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalContentPanel
        session={{
          approverId: ctx.approverId,
          organizationId: ctx.organizationId,
          customerId: ctx.customerId,
          mustChangePassword: false,
        }}
        month={searchParams.month}
      />
    </PortalShell>
  );
}
