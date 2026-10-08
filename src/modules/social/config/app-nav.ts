import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  ChartColumn,
  CreditCard,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Megaphone,
  MessageCircle,
  Plug,
  Puzzle,
  Settings,
  Sparkles,
  Users,
  FileText,
  Contact,
} from 'lucide-react';
import { SOCIAL_BASE_PATH } from './navigation';

export interface SocialAppNavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Show the persistent Channels panel next to this page. */
  showChannelsPanel?: boolean;
}

export const socialAppNav: SocialAppNavItem[] = [
  {
    key: 'calendar',
    label: 'Calendar',
    href: `${SOCIAL_BASE_PATH}/calendar`,
    icon: CalendarDays,
    showChannelsPanel: true,
  },
  {
    key: 'ai',
    label: 'Agent',
    href: `${SOCIAL_BASE_PATH}/ai`,
    icon: Sparkles,
    showChannelsPanel: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    href: `${SOCIAL_BASE_PATH}/analytics`,
    icon: ChartColumn,
    showChannelsPanel: true,
  },
  {
    key: 'media',
    label: 'Media',
    href: `${SOCIAL_BASE_PATH}/media`,
    icon: ImageIcon,
  },
  {
    key: 'automation',
    label: 'Plugs',
    href: `${SOCIAL_BASE_PATH}/automation`,
    icon: Plug,
  },
  {
    key: 'channels',
    label: 'Integrations',
    href: `${SOCIAL_BASE_PATH}/channels`,
    icon: Puzzle,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    href: `${SOCIAL_BASE_PATH}/whatsapp`,
    icon: MessageCircle,
  },
  {
    key: 'ads',
    label: 'Ads',
    href: `${SOCIAL_BASE_PATH}/ads`,
    icon: Megaphone,
  },
  {
    key: 'settings',
    label: 'Settings',
    href: `${SOCIAL_BASE_PATH}/settings`,
    icon: Settings,
  },
  {
    key: 'clients',
    label: 'Clients',
    href: `${SOCIAL_BASE_PATH}/clients`,
    icon: Users,
  },
  {
    key: 'inbox',
    label: 'Inbox',
    href: `${SOCIAL_BASE_PATH}/inbox`,
    icon: Inbox,
  },
  {
    key: 'leads',
    label: 'Leads',
    href: `${SOCIAL_BASE_PATH}/leads`,
    icon: Contact,
  },
  {
    key: 'reports',
    label: 'Reports',
    href: `${SOCIAL_BASE_PATH}/reports`,
    icon: FileText,
  },
  {
    key: 'billing',
    label: 'Billing',
    href: `${SOCIAL_BASE_PATH}/billing`,
    icon: CreditCard,
  },
  {
    key: 'api',
    label: 'API',
    href: `${SOCIAL_BASE_PATH}/api`,
    icon: KeyRound,
  },
];

export const socialAppHome = `${SOCIAL_BASE_PATH}/calendar`;

export function getSocialAppNavItem(pathname: string): SocialAppNavItem | undefined {
  return socialAppNav.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}
