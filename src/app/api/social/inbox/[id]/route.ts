import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const { id } = await context.params;
    const thread = await inboxService.getThread(organization.id, id);
    if (!thread) {
      throw new HttpError(404, 'Thread not found');
    }
    return Response.json(thread);
  } catch (error) {
    return errorResponse(error);
  }
}
