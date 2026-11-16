import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { createOpsClientSchema } from '@/modules/social/server/ops/ops.schema';
import { opsService } from '@/modules/social/server/ops/ops.service';

export async function GET() {
  try {
    const ctx = await requireRole('ADMIN');
    return NextResponse.json(await opsService.listClients(ctx.organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = createOpsClientSchema.parse(await req.json());
    const client = await opsService.createClient(ctx.organization.id, body);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
