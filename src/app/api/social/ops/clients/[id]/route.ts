import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { updateOpsClientSchema } from '@/modules/social/server/ops/ops.schema';
import { opsService } from '@/modules/social/server/ops/ops.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireRole('ADMIN');
    const { id } = await params;
    return NextResponse.json(await opsService.getClient(ctx.organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireRole('ADMIN');
    const { id } = await params;
    const body = updateOpsClientSchema.parse(await req.json());
    return NextResponse.json(await opsService.updateClient(ctx.organization.id, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireRole('ADMIN');
    const { id } = await params;
    return NextResponse.json(await opsService.deleteClient(ctx.organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
