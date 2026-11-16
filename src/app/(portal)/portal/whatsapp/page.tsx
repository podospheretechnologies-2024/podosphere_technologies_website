import { PortalWhatsAppPanel } from '@/modules/social/components/portal/portal-whatsapp-panel';
import { PortalShell } from '@/modules/social/components/shell/portal-shell';
import { portalWhatsAppService } from '@/modules/social/server/portal/portal-whatsapp.service';
import { requirePortalPage } from '@/modules/social/server/portal/portal-page';

export default async function PortalWhatsAppPage() {
  const ctx = await requirePortalPage('whatsapp');
  const data = await portalWhatsAppService.summary({
    organizationId: ctx.organizationId,
    customerId: ctx.customerId,
  });

  return (
    <PortalShell branding={ctx.branding} nav={ctx.nav}>
      <PortalWhatsAppPanel data={data} />
    </PortalShell>
  );
}
