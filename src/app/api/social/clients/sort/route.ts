import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import { bulkAssignSchema } from '@/modules/social/server/customers/customer.schema';
import { customerService } from '@/modules/social/server/customers/customer.service';

/** Admin: unassigned channels / ad accounts grouped into suggested clients. */
export async function GET() {
  try {
    const ctx = await requireRole('ADMIN');
    return NextResponse.json(await customerService.suggestAssignments(ctx.organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

/** Admin: create the new clients and move each confirmed group's assets onto its client. */
export async function POST(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = bulkAssignSchema.parse(await req.json());
    const result = await customerService.bulkAssign(ctx.organization.id, body);
    await logAudit({
      action: 'clients.bulk_assign',
      targetType: 'SocialCustomer',
      targetId: ctx.organization.id,
      metadata: { groups: body.groups.length, ...result },
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
