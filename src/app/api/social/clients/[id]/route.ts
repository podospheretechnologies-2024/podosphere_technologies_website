import type { NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import { updateClientLinksSchema } from '@/modules/social/server/customers/customer.schema';
import { customerService } from '@/modules/social/server/customers/customer.service';

/** Admin: replace the social channels and Meta/Google ad accounts linked to this client. */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const ctx = await requireRole('ADMIN');
    const body = updateClientLinksSchema.parse(await request.json());
    const customer = await customerService.updateClientLinks(ctx.organization.id, id, body);

    await logAudit({
      action: 'update_client_links',
      targetType: 'SocialCustomer',
      targetId: customer.id,
      metadata: {
        channels: body.integrationIds?.length ?? 0,
        metaAds: body.adAccountIds?.length ?? 0,
        googleAds: body.googleAdAccountIds?.length ?? 0,
      },
    });

    return Response.json(customer);
  } catch (error) {
    return errorResponse(error);
  }
}
