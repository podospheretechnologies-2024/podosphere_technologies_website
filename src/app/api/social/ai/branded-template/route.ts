import type { NextRequest } from 'next/server';
import { renderBrandedTemplateSchema } from '@/modules/social/server/ai/branded-template.schema';
import { brandedTemplateService } from '@/modules/social/server/ai/branded-template.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

/** List built-in branded templates (variables + sizes). */
export async function GET() {
  try {
    await getClientScope('view');
    return Response.json({ templates: brandedTemplateService.list() });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Render a branded template to PNG and save it in the client media library. */
export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('draft');
    const body = renderBrandedTemplateSchema.parse(await request.json());
    return Response.json(await brandedTemplateService.render(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
