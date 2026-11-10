import type { NextRequest } from 'next/server';
import { errorResponse } from '@/shared/server/http-error';
import { growthRequest } from '@/modules/social/server/growth/growth-http';
import { overview } from '@/modules/social/server/growth/growth.service';

export async function GET(request: NextRequest) {
  try {
    const { gc, canReview } = await growthRequest('view');
    const p = request.nextUrl.searchParams;
    const data = await overview(gc, { preset: p.get('preset'), from: p.get('from'), to: p.get('to') });
    return Response.json({ ...data, canReview });
  } catch (error) {
    return errorResponse(error);
  }
}
