import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';
import { logAudit } from '@/shared/server/audit.service';
import { createClientSchema } from '@/modules/social/server/customers/customer.schema';
import { customerService } from '@/modules/social/server/customers/customer.service';

export async function GET() {
  try {
    const scope = await getClientScope('view');
    return NextResponse.json(await customerService.listCustomers(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = createClientSchema.parse(await req.json());
    const customer = await customerService.createClient(ctx.organization.id, body);

    await logAudit({
      action: 'create_client',
      targetType: 'SocialCustomer',
      targetId: customer.id,
      metadata: { name: body.name, approverEmail: body.approverEmail },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
