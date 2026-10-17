export const ONBOARDING_STEPS = [
  'created',
  'connect_link',
  'channels',
  'brand_kit',
  'done',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isOnboardingStep(value: string): value is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(value);
}
