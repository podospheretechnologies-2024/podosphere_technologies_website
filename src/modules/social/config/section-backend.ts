import dayjs from 'dayjs';
import { ADS_DEFAULT_DATE_PRESET } from './ads';
import type { SocialAppNavItem } from './app-nav';
import { POST_LIST_FILTER_VALUES } from './posts';

export interface SectionBackendEndpoint {
  label: string;
  url: string;
}

/** Primary live GET endpoints for each social section (no mocks). */
export function getSectionBackendEndpoints(
  sectionKey: SocialAppNavItem['key'] | undefined
): SectionBackendEndpoint[] {
  if (!sectionKey) return [];

  const endExclusive = dayjs().add(1, 'day').startOf('day');
  const calendarStart = endExclusive.subtract(31, 'day');
  const analyticsStart = endExclusive.subtract(30, 'day');

  switch (sectionKey) {
    case 'calendar':
      return [
        {
          label: 'Calendar posts (31 days)',
          url: `/api/social/posts/calendar?${new URLSearchParams({
            startDate: calendarStart.toISOString(),
            endDate: endExclusive.toISOString(),
          })}`,
        },
        ...POST_LIST_FILTER_VALUES.map((state) => ({
          label: `Posts list · ${state}`,
          url: `/api/social/posts?${new URLSearchParams({ page: '1', state })}`,
        })),
      ];
    case 'ai':
      return [{ label: 'AI status', url: '/api/social/ai' }];
    case 'analytics':
      return [
        {
          label: 'Analytics summary (30 days)',
          url: `/api/social/analytics?${new URLSearchParams({
            startDate: analyticsStart.toISOString(),
            endDate: endExclusive.toISOString(),
          })}`,
        },
      ];
    case 'media':
      return [
        {
          label: 'Media library page 1',
          url: `/api/social/media?${new URLSearchParams({ page: '1' })}`,
        },
      ];
    case 'automation':
      return [
        { label: 'Webhooks', url: '/api/social/webhooks' },
        { label: 'Autoposts', url: '/api/social/autoposts' },
        { label: 'Google Sheets', url: '/api/social/google-sheets' },
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

export { ADS_DEFAULT_DATE_PRESET };
