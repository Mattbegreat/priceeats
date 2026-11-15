import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // 讓測試可載入 .tsx 元件 (tsconfig 的 jsx 為 preserve，供 Next.js 使用)
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 60000 },
});
