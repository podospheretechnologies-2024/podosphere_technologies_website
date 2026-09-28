import type { NextRequest } from 'next/server';
import { saveSignatureSchema } from '@/modules/social/server/signatures/signature.schema';
import { signatureService } from '@/modules/social/server/signatures/signature.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    return Response.json(await signatureService.list(organization.id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const body = saveSignatureSchema.parse(await request.json());
    return Response.json(await signatureService.create(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
