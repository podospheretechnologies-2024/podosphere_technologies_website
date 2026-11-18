import { PortalControl } from '@/modules/social/components/clients/portal-control';

/** Agency: what one client sees and can do in their portal. Access is checked by the APIs it calls. */
export default async function ClientPortalControlPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <PortalControl clientId={id} />;
}
