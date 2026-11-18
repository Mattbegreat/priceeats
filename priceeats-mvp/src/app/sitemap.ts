import type { MetadataRoute } from 'next';
import stats from '@/data/area-stats.json';
import { absoluteUrl, allPaths, lastmodFor, taipeiToday, type AreaStats } from '@/lib/area-pages';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const buildDate = taipeiToday();
  const generatedAt = (stats as AreaStats).generatedAt;
  return allPaths().map((p) => ({ url: absoluteUrl(p), lastModified: lastmodFor(p, generatedAt, buildDate) }));
}
