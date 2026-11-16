const demo = process.env.BUILD_DEMO === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(demo
    ? {
        // 靜態匯出示範版：首頁、說明頁、入口頁都輸出成靜態 HTML
        output: 'export',
        // 說明頁與入口頁在子目錄，資產路徑必須是根目錄絕對路徑 (/_next/…)；要放在子路徑時才設 ASSET_PREFIX
        ...(process.env.ASSET_PREFIX ? { assetPrefix: process.env.ASSET_PREFIX } : {}),
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
