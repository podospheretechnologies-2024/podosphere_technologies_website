import { PortalBrandPanel } from '@/modules/social/components/portal/portal-brand-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalBrandPage() {
  const ctx = await requirePortalPage('brand');
  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalBrandPanel />
    </PortalShell>
  );
}
