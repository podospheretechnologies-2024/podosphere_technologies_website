import type { NavItem, NavSection } from '@/shared/types/navigation';

export const SOCIAL_BASE_PATH = '/dashboard/social';

export const socialSections = {
  calendar: {
    label: 'Calendar',
    href: `${SOCIAL_BASE_PATH}/calendar`,
    description: 'Plan, schedule and publish posts across all channels.',
  },
  channels: {
    label: 'Channels',
    href: `${SOCIAL_BASE_PATH}/channels`,
    description: 'Connect and manage social media accounts.',
  },
  media: {
    label: 'Media',
    href: `${SOCIAL_BASE_PATH}/media`,
    description: 'Upload and organise images and videos for your posts.',
  },
  ai: {
    label: 'AI Studio',
    href: `${SOCIAL_BASE_PATH}/ai`,
    description: 'Generate post ideas, threads and images with AI.',
  },
  automation: {
    label: 'Automation',
    href: `${SOCIAL_BASE_PATH}/automation`,
    description: 'Auto-post from RSS feeds and send webhooks after publishing.',
  },
  analytics: {
    label: 'Analytics',
    href: `${SOCIAL_BASE_PATH}/analytics`,
    description: 'Track channel and post performance.',
  },
  settings: {
    label: 'Settings',
    href: `${SOCIAL_BASE_PATH}/settings`,
    description: 'Signatures, post templates, tags and posting time slots.',
  },
} satisfies Record<string, NavItem>;

export type SocialSectionKey = keyof typeof socialSections;

export const socialNavigation: NavSection = {
  title: 'Social Media',
  items: Object.values(socialSections),
};
