import 'server-only';
import { prisma } from '@/shared/lib/prisma';
import { ONBOARDING_STEPS, type OnboardingStep } from '../../config/client-onboarding';

const rank = (step: string) => (ONBOARDING_STEPS as readonly string[]).indexOf(step);

/**
 * PS-25: move a client's onboarding step forward (never back) when real progress happens:
 * magic link made -> connect_link, channels linked -> brand_kit, brand kit saved -> done.
 * Best effort; a failure here must never break the action that triggered it.
 */
export async function advanceOnboardingStep(
  organizationId: string,
  customerId: string | null,
  step: OnboardingStep
): Promise<void> {
  if (!customerId) return;
  try {
    const customer = await prisma.socialCustomer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { onboardingStep: true },
    });
    if (!customer || rank(customer.onboardingStep) >= rank(step)) return;
    await prisma.socialCustomer.update({ where: { id: customerId }, data: { onboardingStep: step } });
  } catch (error) {
    console.warn(
      `[onboarding] could not advance ${customerId} to ${step}: ${error instanceof Error ? error.message : 'unknown'}`
    );
  }
}
