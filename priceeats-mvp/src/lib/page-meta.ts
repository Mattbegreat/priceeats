import type { Metadata } from 'next';
import { OG_IMAGE_URL, SITE_URL } from './site';

/** 內容頁的 metadata：獨立 title／description／canonical，並保留 og:image (頁面層的 openGraph 會整個覆蓋 layout 的) */
export function pageMetadata(title: string, description: string, path: string): Metadata {
  const fullTitle = `${title}｜PriceEats`;
  const url = `${SITE_URL}${path}`;
  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'zh_TW',
      siteName: 'PriceEats',
      url,
      title: fullTitle,
      description,
      images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: 'PriceEats：今天這餐，最多花多少？' }],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [OG_IMAGE_URL] },
  };
}
