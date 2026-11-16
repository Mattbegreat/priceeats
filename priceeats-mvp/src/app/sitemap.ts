import type { MetadataRoute } from 'next';
import { absoluteUrl, allPaths } from '@/lib/area-pages';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return allPaths().map((p) => ({ url: absoluteUrl(p) }));
}
