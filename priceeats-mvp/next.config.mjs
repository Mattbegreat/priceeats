const demo = process.env.BUILD_DEMO === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(demo
    ? {
        // 靜態匯出示範版：單一 index.html，資產路徑相對
        output: 'export',
        assetPrefix: './',
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
