import type { NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import { applyTemplateSchema } from '@/modules/social/server/client-templates/client-template.schema';
import { clientTemplateService } from '@/modules/social/server/client-templates/client-template.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = applyTemplateSchema.parse(await request.json());
    const customer = await clientTemplateService.applyTemplate(ctx.organization.id, body);
    await logAudit({
      action: 'apply_client_template',
      targetType: 'SocialCustomer',
      targetId: customer.id,
      metadata: { templateId: body.templateId, name: body.name },
    });
    return Response.json(customer, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
