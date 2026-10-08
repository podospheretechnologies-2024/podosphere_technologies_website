import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse, methodNotAllowed } from '@/shared/server/http-error';

const schema = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
  language: z.string().min(2).default('en'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('UTILITY'),
  body: z.string().trim().min(1).max(1024),
});

export function GET() {
  return methodNotAllowed('POST');
}

export async function POST(request: NextRequest) {
  try {
    const organization = await getCurrentOrganization();
    await requireRole('ADMIN');
    const body = schema.parse(await request.json());
    return Response.json(await whatsappOnboardingService.createTemplate(organization.id, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
