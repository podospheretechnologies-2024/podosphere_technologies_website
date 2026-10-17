import type { NextRequest } from 'next/server';
import { saveSignatureSchema } from '@/modules/social/server/signatures/signature.schema';
import { signatureService } from '@/modules/social/server/signatures/signature.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/signatures/[id]'>) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    const body = saveSignatureSchema.parse(await request.json());
    return Response.json(await signatureService.update(scope, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/social/signatures/[id]'>
) {
  try {
    const { id } = await ctx.params;
    const scope = await getClientScope('draft');
    await signatureService.remove(scope, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
