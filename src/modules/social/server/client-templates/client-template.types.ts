export type { OnboardingStep } from '../../config/client-onboarding';
export { ONBOARDING_STEPS, isOnboardingStep } from '../../config/client-onboarding';

/** JSON snapshot stored on SocialClientTemplate.data */
export type ClientTemplatePostingHint = { time: number };

export type ClientTemplateTag = { name: string; color: string };

export type ClientTemplateSignature = { content: string; autoAdd: boolean };

export type ClientTemplateSet = {
  name: string;
  content: unknown;
  /** Providers the source set targeted; used to re-bind after channels connect. */
  channelProviders?: string[];
};

export type ClientTemplateSourceChannel = {
  id: string;
  providerIdentifier: string;
};

/** Copied onto SocialCustomer.templateBootstrap when a template is applied. */
export type ClientTemplateBootstrap = {
  postingScheduleHints?: ClientTemplatePostingHint[];
  sourceChannels?: ClientTemplateSourceChannel[];
};

export type ClientTemplateData = {
  brandKit?: Record<string, string> | null;
  tags?: ClientTemplateTag[];
  signatures?: ClientTemplateSignature[];
  sets?: ClientTemplateSet[];
  /** Preferred posting times in minutes after midnight (UTC). */
  postingScheduleHints?: ClientTemplatePostingHint[];
  /** Source client channels — id + provider for set remapping. */
  sourceChannels?: ClientTemplateSourceChannel[];
};
