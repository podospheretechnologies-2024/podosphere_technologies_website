import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Meta must be able to fetch /privacy, /terms and /data-deletion for app review.
      { userAgent: ['facebookexternalhit', 'meta-externalagent', 'Facebot'], allow: '/' },
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api'] },
    ],
  };
}
