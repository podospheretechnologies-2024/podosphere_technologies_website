import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { requireRole } from '@/shared/server/access';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { errorResponse, HttpError } from '@/shared/server/http-error';
import { isValidCustomHostname, normalizeHostname } from '@/shared/server/org-branding';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const org = await prisma.organization.findUnique({
      where: { id: organization.id },
      select: { customDomain: true },
    });
    return Response.json({ customDomain: org?.customDomain ?? null });
  } catch (error) {
    return errorResponse(error);
  }
}

const schema = z.object({
  /** Hostname only (e.g. portal.client.com). Pass null to clear. */
  customDomain: z.string().nullable(),
});

export async function PUT(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');

    const body = schema.parse(await request.json());
    let customDomain: string | null = null;

    if (body.customDomain !== null) {
      const normalized = normalizeHostname(body.customDomain);
      if (!normalized || !isValidCustomHostname(normalized)) {
        throw new HttpError(400, 'Invalid hostname (use a bare domain like portal.example.com)');
      }
      customDomain = normalized;
    }

    try {
      const updated = await prisma.organization.update({
        where: { id: organization.id },
        data: { customDomain },
        select: { customDomain: true },
      });
      return Response.json({ customDomain: updated.customDomain });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'That custom domain is already in use');
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
