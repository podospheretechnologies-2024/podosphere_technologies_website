import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { whatsappOnboardingService } from '@/modules/social/server/whatsapp/whatsapp-growth.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';

const schema = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
  language: z.string().min(2).default('en'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('UTILITY'),
  body: z.string().trim().min(1).max(1024),
});

export async function GET() {
  try {
    const scope = await getClientScope('inbox');
    return Response.json(await whatsappOnboardingService.listTemplates(scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const name = request.nextUrl.searchParams.get('name');
    if (!name) return new Response('Missing name parameter', { status: 400 });
    return Response.json(await whatsappOnboardingService.deleteTemplate(scope, name));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('inbox');
    const body = schema.parse(await request.json());
    return Response.json(await whatsappOnboardingService.createTemplate(scope, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
