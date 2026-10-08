import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
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
    await requireRole('ADMIN');
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return new NextResponse('Missing ID', { status: 400 });

    const deleted = await prisma.socialCompetitor.deleteMany({
      where: { id, organizationId: organization.id },
    });
    if (deleted.count === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
