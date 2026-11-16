import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import {
  monthKeyFromDate,
  OPS_SERVICE_CATEGORIES,
  type OpsServiceCategory,
} from '@/modules/social/server/ops/ops.constants';
import { opsService } from '@/modules/social/server/ops/ops.service';

export async function GET(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const url = new URL(req.url);
    const category = (url.searchParams.get('category') ?? 'website') as OpsServiceCategory;
    if (!OPS_SERVICE_CATEGORIES.includes(category)) {
      throw new HttpError(400, 'Invalid service category');
    }
    const monthKey = url.searchParams.get('monthKey') ?? monthKeyFromDate(new Date());
    return NextResponse.json(await opsService.servicesView(ctx.organization.id, category, monthKey));
  } catch (error) {
    return errorResponse(error);
  }
}
