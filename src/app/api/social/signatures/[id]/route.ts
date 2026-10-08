import type { NextRequest } from 'next/server';
import { saveSignatureSchema } from '@/modules/social/server/signatures/signature.schema';
import { signatureService } from '@/modules/social/server/signatures/signature.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/social/signatures/[id]'>) {
  try {
    const { id } = await ctx.params;
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = saveSignatureSchema.parse(await request.json());
    return Response.json(await signatureService.update(organization.id, id, body));
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
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    await signatureService.remove(organization.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
