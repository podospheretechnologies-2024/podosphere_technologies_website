import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { approvalService } from '@/modules/social/server/approvals/approval.service';
import { prisma } from '@/shared/lib/prisma';
import { integrationRegistry } from '@/modules/social/server/integrations/core/integration.registry';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('approver_session')?.value;
  
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const verified = await approvalService.verifyToken(token);
    
    const integrations = await prisma.socialIntegration.findMany({
      where: {
        organizationId: verified.organizationId,
        customerId: verified.customerId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const channels = integrations.map(row => ({
      id: row.id,
      providerIdentifier: row.providerIdentifier,
      providerName: integrationRegistry.get(row.providerIdentifier)?.name ?? row.providerIdentifier,
      name: row.name,
      username: row.username,
      picture: row.picture,
      disabled: row.disabled,
      refreshNeeded: row.refreshNeeded,
      inBetweenSteps: row.inBetweenSteps,
    }));

    return NextResponse.json(channels);
  } catch (err) {
    return new NextResponse('Invalid session', { status: 401 });
  }
}
