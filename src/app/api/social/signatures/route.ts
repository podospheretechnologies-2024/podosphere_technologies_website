import type { NextRequest } from 'next/server';
import { saveSignatureSchema } from '@/modules/social/server/signatures/signature.schema';
import { signatureService } from '@/modules/social/server/signatures/signature.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await signatureService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = saveSignatureSchema.parse(await request.json());
    return Response.json(await signatureService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
