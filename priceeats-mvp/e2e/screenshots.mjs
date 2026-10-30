// npm run screenshots：對 out/ 在 390、1440 寬各截 首頁、結果、詳情、地圖、上傳 共 10 張，存到 docs/screenshots/
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const dir = resolve(import.meta.dirname, '../docs/screenshots');
mkdirSync(dir, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'zh-TW' });
    const page = await context.newPage();
    const shot = (name) => page.screenshot({ path: resolve(dir, `${width}-${name}.png`) });
    await page.goto(server.url);
    await page.getByTestId('search-button').waitFor();
    await shot('1-home');
    await page.getByRole('button', { name: '類型 肉類' }).click();
    await page.getByTestId('search-button').click();
    await page.getByTestId('food-card').first().waitFor();
    await shot('2-results');
    await page.getByTestId('food-card').first().click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(300);
    await shot('3-detail');
    await page.getByRole('button', { name: '關閉詳情' }).click();
    await page.getByTestId('nav-map').click();
    await page.locator('.price-marker').first().waitFor();
    await page.waitForTimeout(1500);
    await shot('4-map');
    await page.getByTestId('nav-upload').click();
    await page.getByLabel('選擇菜單照片').waitFor();
    await shot('5-upload');
    await context.close();
  }
  console.log('截圖完成：', dir);
} finally {
  await browser.close();
  await server.close();
}
