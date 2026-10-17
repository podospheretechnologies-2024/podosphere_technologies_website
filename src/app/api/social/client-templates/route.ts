import type { NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import { saveTemplateSchema } from '@/modules/social/server/client-templates/client-template.schema';
import { clientTemplateService } from '@/modules/social/server/client-templates/client-template.service';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return Response.json(await clientTemplateService.list(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = saveTemplateSchema.parse(await request.json());
    const template = await clientTemplateService.saveFromClient(ctx.organization.id, body);
    await logAudit({
      action: 'create_client_template',
      targetType: 'SocialClientTemplate',
      targetId: template.id,
      metadata: { name: template.name, sourceCustomerId: body.sourceCustomerId ?? null },
    });
    return Response.json(template, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
