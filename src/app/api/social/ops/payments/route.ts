import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { createOpsPaymentSchema } from '@/modules/social/server/ops/ops.schema';
import { opsService } from '@/modules/social/server/ops/ops.service';

export async function GET(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const monthKey = new URL(req.url).searchParams.get('monthKey') ?? undefined;
    return NextResponse.json(await opsService.listPayments(ctx.organization.id, monthKey));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = createOpsPaymentSchema.parse(await req.json());
    const payment = await opsService.createPayment(ctx.organization.id, body);
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
