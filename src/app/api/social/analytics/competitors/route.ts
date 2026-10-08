import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentOrganization } from '@/shared/server/current-organization';

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const body = await request.json();
    const { name, externalId, platform } = body;

    if (!name || !externalId || !platform) {
      return new NextResponse('Missing fields', { status: 400 });
    }

    const competitor = await prisma.socialCompetitor.create({
      data: {
        organizationId: organization.id,
        name,
        externalId,
        platform,
      }
    });

    return NextResponse.json(competitor);
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return new NextResponse('Missing ID', { status: 400 });

    await prisma.socialCompetitor.delete({
      where: { id, organizationId: organization.id }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
