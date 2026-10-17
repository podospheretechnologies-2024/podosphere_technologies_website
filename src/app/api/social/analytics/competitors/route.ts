import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { getClientScope } from '@/shared/server/client-scope';

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('view');
    const body = await request.json();
    const { name, externalId, platform } = body;

    if (!name || !externalId || !platform) {
      return new NextResponse('Missing fields', { status: 400 });
    }

    const competitor = await prisma.socialCompetitor.create({
      data: {
        organizationId: scope.organizationId,
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
    const scope = await getClientScope('view');
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) return new NextResponse('Missing ID', { status: 400 });

    const deleted = await prisma.socialCompetitor.deleteMany({
      where: { id, organizationId: scope.organizationId },
    });
    if (deleted.count === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}
