import type { Metadata, Viewport } from 'next';
import { IS_REAL_DATA } from '@/data/centers';
import { siteDescription } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: 'PriceEats 以預算找餐點',
  description: siteDescription(IS_REAL_DATA),
};

export const viewport: Viewport = {
  themeColor: '#172C28',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        {/* 相對路徑：靜態匯出後放在任何子路徑 (如 Netlify) 都能運作 */}
        <link rel="manifest" href="./manifest.webmanifest" />
        <link rel="icon" href="./icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="./icon-192.png" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
