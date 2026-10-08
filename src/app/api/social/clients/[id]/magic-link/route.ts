import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { getAccess } from '@/shared/server/access';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { getServerEnv } from '@/shared/lib/env';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAccess();
    const { id } = await props.params;

    // Verify ownership
    const customer = await prisma.socialCustomer.findFirst({
      where: { id, organizationId: ctx.organization.id },
      include: { approvers: true }
    });

    if (!customer) {
      return new NextResponse('Customer not found', { status: 404 });
    }

    if (!customer.approvers.length) {
      return new NextResponse('No approvers found for this client', { status: 400 });
    }

    const approver = customer.approvers[0];
    const token = await approvalService.generateMagicLink(approver.id);

    // Return the full magic link URL
    const env = getServerEnv();
    const magicLink = `${env.APP_URL}/api/approver/verify?token=${token}`;

    return NextResponse.json({ magicLink });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
