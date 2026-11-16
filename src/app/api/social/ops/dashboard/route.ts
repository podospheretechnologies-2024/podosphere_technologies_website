import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { monthKeyFromDate } from '@/modules/social/server/ops/ops.constants';
import { opsService } from '@/modules/social/server/ops/ops.service';

export async function GET(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const monthKey =
      new URL(req.url).searchParams.get('monthKey') ?? monthKeyFromDate(new Date());
    return NextResponse.json(await opsService.dashboard(ctx.organization.id, monthKey));
  } catch (error) {
    return errorResponse(error);
  }
}
