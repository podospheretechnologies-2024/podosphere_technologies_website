import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { updateOpsPaymentSchema } from '@/modules/social/server/ops/ops.schema';
import { opsService } from '@/modules/social/server/ops/ops.service';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireRole('ADMIN');
    const { id } = await params;
    const body = updateOpsPaymentSchema.parse(await req.json());
    return NextResponse.json(await opsService.updatePayment(ctx.organization.id, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireRole('ADMIN');
    const { id } = await params;
    return NextResponse.json(await opsService.deletePayment(ctx.organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
