import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/checkout', '/order', '/account', '/track'] },
    sitemap: base + '/sitemap.xml',
  };
}
