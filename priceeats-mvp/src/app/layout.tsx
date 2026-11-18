import type { Metadata, Viewport } from 'next';
import { IS_REAL_DATA } from '@/data/centers';
import { OG_IMAGE_URL, SITE_TITLE, SITE_URL, siteDescription } from '@/lib/site';
import { Analytics } from '@/components/Analytics';
import './globals.css';

const DESCRIPTION = siteDescription(IS_REAL_DATA);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  verification: { google: 'AlBF-8ICckImbt6pAuA62T4qmFs8SKW14jCUa05HtQk' },
  title: SITE_TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    siteName: 'PriceEats',
    url: SITE_URL,
    title: SITE_TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: 'PriceEats：今天這餐，最多花多少？' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
  applicationName: 'PriceEats',
  appleWebApp: { capable: true, title: 'PriceEats', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#D5DEE6',
  width: 'device-width',
  initialScale: 1,
};

/** 字型：Noto Sans TC (中文)、IBM Plex Mono (金額、距離)。
 *  用 <link> 載入 Google Fonts 而不是 next/font：建置時不必連外抓字型 (離線／CI 也能建置)，
 *  CSS 由 Google 依瀏覽器切成 unicode-range 子集，只下載用到的字；display=swap 讓文字先以系統字型顯示。
 *  樣式表以 script 非同步插入，不阻擋首次繪製與互動 (沒有 JS 時由 noscript 補上)。 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=IBM+Plex+Mono:wght@500;600&display=swap';
const FONT_LOADER = `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='${FONT_HREF}';document.head.appendChild(l);})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        {/* 絕對路徑：說明頁與入口頁在子目錄 (/about/…、/area/…)，相對路徑會找不到 */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: FONT_LOADER }} />
        <noscript>
          <link rel="stylesheet" href={FONT_HREF} />
        </noscript>
      </head>
      <body className="bg-ground font-sans text-ink antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
