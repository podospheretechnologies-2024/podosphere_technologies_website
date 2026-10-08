import { inboxService } from '@/modules/social/server/inbox/inbox.service';
import { planService } from '@/modules/social/server/billing/plan.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    await planService.assertFeature(organization.id, 'inbox');
    return Response.json(await inboxService.listThreads(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}
