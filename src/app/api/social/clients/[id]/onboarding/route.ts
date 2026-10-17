import type { NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/access';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse } from '@/shared/server/http-error';
import { onboardingStepSchema } from '@/modules/social/server/client-templates/client-template.schema';
import { clientTemplateService } from '@/modules/social/server/client-templates/client-template.service';

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const scope = await getClientScope('view');
    const customer = await clientTemplateService.getCustomerForOnboarding(scope, id);
    return Response.json(customer);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const ctx = await requireRole('ADMIN');
    const body = onboardingStepSchema.parse(await request.json());
    const customer = await clientTemplateService.setOnboardingStep(
      ctx.organization.id,
      id,
      body.step
    );
    return Response.json(customer);
  } catch (error) {
    return errorResponse(error);
  }
}
