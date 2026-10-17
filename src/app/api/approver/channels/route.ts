import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { integrationRegistry } from '@/modules/social/server/integrations/core/integration.registry';
import { getPortalSession } from '@/shared/server/portal-session';

export async function GET() {
  try {
    const verified = await getPortalSession();

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
