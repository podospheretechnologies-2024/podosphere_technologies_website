import type { MetadataRoute } from 'next';
import { FEATURE_SLUGS } from '@/modules/marketing/config/features';
import { COMPARE_PAGES, FOR_PAGES } from '@/modules/marketing/config/seo-pages';
import { SITE_URL } from '@/modules/marketing/config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    '',
    '/pricing',
    '/docs/api',
    '/privacy',
    '/terms',
    '/data-deletion',
    '/support',
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${SITE_URL}${path || '/'}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
    })),
    ...FEATURE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/features/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...Object.keys(FOR_PAGES).map((slug) => ({
      url: `${SITE_URL}/for/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...Object.keys(COMPARE_PAGES).map((slug) => ({
      url: `${SITE_URL}/compare/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
