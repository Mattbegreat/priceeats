// 產生分享預覽圖 public/og.png (1200x630，收據風格)：用 Playwright 對一段本地 HTML 截圖，不新增套件。
// 用法：node scripts/make-og.mjs [--fonts <含 fonts.css 的資料夾>]
// 字型：預設用系統已安裝的 Noto Sans TC／IBM Plex Mono，找不到就退回系統中文字型；
//       沙盒沒有安裝字型時以 --fonts 指定資料夾 (fonts.css 內的 gstatic 網址會改指向該資料夾的檔案)。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const fi = args.indexOf('--fonts');
const fontsDir = fi >= 0 ? resolve(args[fi + 1]) : null;
let fontCss = '';
if (fontsDir) {
  const base = pathToFileURL(fontsDir).href + '/';
  fontCss = readFileSync(resolve(fontsDir, 'fonts.css'), 'utf8').replace(/https:\/\/fonts\.gstatic\.com\/s\/[^/]+\/v\d+\//g, base);
}

const html = `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><style>
${fontCss}
:root { --ground:#D5DEE6; --paper:#FBFBF7; --ink:#22252A; --carbon:#2B4C9B; --stamp:#D2332B; --leader:#9AA3AD; --edge:#B9C4CE; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: var(--ground); font-family: 'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif; color: var(--ink); position: relative; overflow: hidden; }
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 600; }
.receipt { position: absolute; left: 150px; top: 40px; width: 900px; height: 548px; background: var(--paper); box-shadow: 0 6px 0 var(--edge);
  padding: 46px 64px 0; --z: 18px;
  -webkit-mask: linear-gradient(135deg, transparent 9px, #000 0) bottom left / 18px 100% repeat-x, linear-gradient(225deg, transparent 9px, #000 0) bottom right / 18px 100% repeat-x; }
.brand { display: flex; justify-content: space-between; align-items: baseline; font-size: 30px; font-weight: 900; padding-bottom: 16px; border-bottom: 3px solid var(--ink); }
.brand span:last-child { font-size: 26px; color: var(--carbon); }
h1 { font-size: 92px; line-height: 1.16; font-weight: 900; margin-top: 52px; letter-spacing: 1px; }
.row { display: flex; align-items: baseline; gap: 14px; margin-top: 48px; font-size: 34px; font-weight: 700; }
.dots { flex: 1; border-bottom: 4px dotted var(--leader); transform: translateY(-8px); }
.row .mono { font-size: 40px; }
.stamp { position: absolute; right: 70px; top: 196px; border: 5px solid var(--stamp); color: var(--stamp); font-weight: 900; font-size: 34px; padding: 6px 18px; border-radius: 6px; transform: rotate(-8deg); }
</style></head><body>
<div class="receipt">
  <div class="brand"><span>PriceEats</span><span>以預算找附近餐點</span></div>
  <h1>今天這餐，<br>最多花多少？</h1>
  <div class="row"><span>輸入預算，找店內價</span><span class="dots"></span><span class="mono">$100</span></div>
  <div class="stamp">預算內</div>
</div>
</body></html>`;

const px = process.env.HTTPS_PROXY;
const browser = await chromium.launch({ args: ['--no-sandbox'], ...(px ? { proxy: { server: px, bypass: '127.0.0.1,localhost' } } : {}) });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
writeFileSync(resolve(root, 'public/og.png'), buf);
await browser.close();
console.log('public/og.png', buf.length, 'bytes');
