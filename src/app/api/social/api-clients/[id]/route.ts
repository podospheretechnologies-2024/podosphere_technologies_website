import { apiClientService } from '@/modules/social/server/api-clients/api-client.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const { id } = await context.params;
    await apiClientService.revoke(organization.id, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
