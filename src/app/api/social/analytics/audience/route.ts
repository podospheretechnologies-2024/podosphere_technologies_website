import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentOrganization } from '@/shared/server/current-organization';

export async function GET(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    
    // Fetch daily insights for the organization's integrations
    const integrations = await prisma.socialIntegration.findMany({
      where: { organizationId: organization.id, deletedAt: null },
      select: { id: true, name: true, providerIdentifier: true }
    });
    
    const integrationIds = integrations.map(i => i.id);
    const dailyInsights = await prisma.socialInsightDaily.findMany({
      where: { integrationId: { in: integrationIds }, metric: 'followers' },
      orderBy: { date: 'asc' }
    });

    // Fetch competitors and their snapshots
    const competitors = await prisma.socialCompetitor.findMany({
      where: { organizationId: organization.id },
      include: {
        snapshots: {
          orderBy: { date: 'asc' }
        }
      }
    });

    return NextResponse.json({
      integrations,
      dailyInsights,
      competitors
    });
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
