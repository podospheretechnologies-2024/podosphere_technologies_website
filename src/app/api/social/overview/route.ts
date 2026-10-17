import { NextResponse } from 'next/server';
import { overviewService } from '@/modules/social/server/overview/overview.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    const overview = await overviewService.summarize(scope);
    return NextResponse.json(overview);
  } catch (error) {
    return errorResponse(error);
  }
}
