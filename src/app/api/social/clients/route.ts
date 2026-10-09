import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { getAccess, requireRole } from '@/shared/server/access';
import { customerService } from '@/modules/social/server/customers/customer.service';
import { logAudit } from '@/shared/server/audit.service';

export async function GET() {
  try {
    const ctx = await getAccess();
    
    // Fetch clients along with their approvers and linked ad accounts
    const clients = await prisma.socialCustomer.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        approvers: true,
        adAccounts: true,
        integrations: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(clients);
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireRole('ADMIN');
    const body = await req.json();
    const { name, approverName, approverEmail, adAccountId, integrationId } = body;

    if (!name || !approverName || !approverEmail) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // 1. Create the Client Profile
    const customer = await customerService.createCustomer(name, approverEmail);

    // 2. Create the Approver Login
    await prisma.clientApprover.create({
      data: { 
        organizationId: ctx.organization.id, 
        customerId: customer.id, 
        email: approverEmail, 
        name: approverName 
      }
    });

    // 3. Link Ad Account if provided
    if (adAccountId) {
      await prisma.adAccount.update({
        where: { externalId: adAccountId },
        data: { customerId: customer.id }
      });
    }

    // 4. Link Social Integration if provided
    if (integrationId) {
      await prisma.socialIntegration.update({
        where: { id: integrationId },
        data: { customerId: customer.id }
      });
    }

    await logAudit({
      action: 'create_client',
      targetType: 'SocialCustomer',
      targetId: customer.id,
      metadata: { name, approverEmail }
    });

    return NextResponse.json(customer);
  } catch (error: any) {
    return new NextResponse(error.message, { status: 400 });
  }
}
