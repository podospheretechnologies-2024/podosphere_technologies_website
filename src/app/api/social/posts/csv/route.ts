import type { NextRequest } from 'next/server';
import { csvImportCreateSchema } from '@/modules/social/server/posts/csv-import.schema';
import { csvImportService } from '@/modules/social/server/posts/csv-import.service';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const scope = await getClientScope('publish');
    const body = csvImportCreateSchema.parse(await request.json());
    return Response.json(await csvImportService.create(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
