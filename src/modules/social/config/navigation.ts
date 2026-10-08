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
    label: 'Agent',
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
  ads: {
    label: 'Ads',
    href: `${SOCIAL_BASE_PATH}/ads`,
    description: 'Live ads, spend and campaigns from your Meta ad accounts (read-only).',
  },
  whatsapp: {
    label: 'WhatsApp',
    href: `${SOCIAL_BASE_PATH}/whatsapp`,
    description: 'Chats, replies and templates from your WhatsApp business number.',
  },
  inbox: {
    label: 'Inbox',
    href: `${SOCIAL_BASE_PATH}/inbox`,
    description: 'Facebook Page and Instagram messages and comments.',
  },
  leads: {
    label: 'Leads',
    href: `${SOCIAL_BASE_PATH}/leads`,
    description: 'Lead-form submissions from connected Pages.',
  },
  reports: {
    label: 'Reports',
    href: `${SOCIAL_BASE_PATH}/reports`,
    description: 'Automated monthly client reports.',
  },
  billing: {
    label: 'Billing',
    href: `${SOCIAL_BASE_PATH}/billing`,
    description: 'Plans, Razorpay checkout and limits.',
  },
  api: {
    label: 'API',
    href: `${SOCIAL_BASE_PATH}/api`,
    description: 'Public API keys for /api/v1.',
  },
  settings: {
    label: 'Settings',
    href: `${SOCIAL_BASE_PATH}/settings`,
    description: 'Signatures, post templates and tags.',
  },
} satisfies Record<string, NavItem>;

export type SocialSectionKey = keyof typeof socialSections;

export const socialNavigation: NavSection = {
  title: 'Social Media',
  items: Object.values(socialSections),
};
