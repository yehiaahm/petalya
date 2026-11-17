import type { MetadataRoute } from 'next';
import { getPublicData } from '@/lib/db';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const db = await getPublicData();
  return [
    { url: base + '/', changeFrequency: 'weekly', priority: 1 },
    { url: base + '/links', changeFrequency: 'monthly', priority: 0.4 },
    { url: base + '/privacy', changeFrequency: 'yearly', priority: 0.2 },
    ...db.products.map((p) => ({ url: `${base}/p/${p.id}`, lastModified: p.updatedAt, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ];
}
