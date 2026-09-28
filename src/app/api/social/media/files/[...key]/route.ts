import type { NextRequest } from 'next/server';
import { createLocalFileResponse } from '@/modules/social/server/storage/local-file-response';

export async function GET(
  request: NextRequest,
  ctx: RouteContext<'/api/social/media/files/[...key]'>
) {
  const { key } = await ctx.params;
  return createLocalFileResponse(key.join('/'), request.headers.get('range'));
}
