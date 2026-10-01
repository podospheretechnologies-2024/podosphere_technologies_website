import dayjs from 'dayjs';
import type { SocialAppNavItem } from './app-nav';

export interface SectionBackendEndpoint {
  label: string;
  url: string;
}

/** Live GET endpoints that back each social section (no mocks). */
export function getSectionBackendEndpoints(
  sectionKey: SocialAppNavItem['key'] | undefined
): SectionBackendEndpoint[] {
  if (!sectionKey) return [];

  const endExclusive = dayjs().add(1, 'day').startOf('day');
  const weekStart = endExclusive.subtract(7, 'day');
  const analyticsStart = endExclusive.subtract(7, 'day');

  switch (sectionKey) {
    case 'calendar':
      return [
        {
          label: 'Calendar posts',
          url: `/api/social/posts/calendar?${new URLSearchParams({
            startDate: weekStart.toISOString(),
            endDate: endExclusive.toISOString(),
          })}`,
        },
        {
          label: 'Posts list',
          url: `/api/social/posts?${new URLSearchParams({ page: '1', state: 'all' })}`,
        },
      ];
    case 'ai':
      return [{ label: 'AI status', url: '/api/social/ai' }];
    case 'analytics':
      return [
        {
          label: 'Analytics summary',
          url: `/api/social/analytics?${new URLSearchParams({
            startDate: analyticsStart.toISOString(),
            endDate: endExclusive.toISOString(),
          })}`,
        },
      ];
    case 'media':
      return [
        {
          label: 'Media library',
          url: `/api/social/media?${new URLSearchParams({ page: '1' })}`,
        },
      ];
    case 'automation':
      return [
        { label: 'Webhooks', url: '/api/social/webhooks' },
        { label: 'Autoposts', url: '/api/social/autoposts' },
      ];
    case 'channels':
      return [{ label: 'Integrations', url: '/api/social/integrations' }];
    case 'whatsapp':
      return [
        { label: 'WhatsApp overview', url: '/api/social/whatsapp' },
        { label: 'Conversations', url: '/api/social/whatsapp/conversations' },
      ];
    case 'ads':
      return [{ label: 'Ad accounts', url: '/api/social/ads/accounts' }];
    case 'settings':
      return [
        { label: 'Signatures', url: '/api/social/signatures' },
        { label: 'Tags', url: '/api/social/tags' },
        { label: 'Templates', url: '/api/social/sets' },
      ];
    default:
      return [];
  }
}
