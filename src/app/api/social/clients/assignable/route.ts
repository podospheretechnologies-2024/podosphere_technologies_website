import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { customerService } from '@/modules/social/server/customers/customer.service';

/** Admin: every workspace channel and Meta/Google ad account, for linking onto a client. */
export async function GET() {
  try {
    const ctx = await requireRole('ADMIN');
    return Response.json(await customerService.listAssignable(ctx.organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}
