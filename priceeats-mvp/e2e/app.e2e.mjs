// Playwright E2E：對 build:demo 的 out/ 起靜態伺服器，chromium；預設視窗 375x812，M4 量測另跑 320x640
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

let server;
let browser;
const VIEWPORT = { width: 375, height: 812 };
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

before(async () => {
  server = await startServer();
  browser = await chromium.launch({ args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

/** 字型來自 Google Fonts：測試不連外 (中斷請求，改用系統字型)，也證明字型載入不影響操作 */
async function blockFonts(context) {
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
}

/** 開新 context/page，記錄頁面錯誤 (忽略外部資源載入失敗，例如沒有網路時的地圖圖磚) */
async function open(path = '', opts = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'zh-TW', ...opts });
  await blockFonts(context);
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(server.url + path);
  await page.getByTestId('search-button').or(page.getByTestId('result-list')).or(page.getByTestId('empty-state')).first().waitFor();
  return { context, page, errors, requests };
}


const cards = (page) => page.getByTestId('food-card');
const num = (t) => Number(String(t).replace(/[^0-9.]/g, ''));
const count = async (page) => num(await page.getByTestId('result-count').innerText());
const openDrawer = async (page) => {
  await page.getByTestId('open-filter').click();
  await page.getByRole('dialog', { name: '改條件' }).waitFor();
};
const closeDrawer = async (page) => {
  await page.getByTestId('drawer-apply').click();
  await page.getByRole('dialog', { name: '改條件' }).waitFor({ state: 'detached' });
};

describe('E2E (build:demo 的 out/，chromium 375x812)', () => {
  it('13. 拒絕 GPS 權限仍能搜尋並出現結果與提示文字，預設中心保留', async () => {
    const { context, page, errors } = await open('', { permissions: [] });
    await page.getByRole('button', { name: '改用我現在的位置' }).click();
    const note = page.getByTestId('location-note');
    await note.waitFor();
    assert.match(await note.innerText(), /預設位置：台北車站/);
    await page.getByTestId('search-button').click();
    await cards(page).first().waitFor();
    assert.ok((await cards(page).count()) > 0, '應有結果');
    assert.match(await page.getByTestId('location-note').innerText(), /預設位置：台北車站/);
    assert.match(await page.getByTestId('center-text').innerText(), /台北車站/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('14. 沒有任何環境變數時正常使用模擬資料 (標示測試資料、不連 Supabase)', async () => {
    const { context, page, requests } = await open();
    assert.match(await page.getByTestId('mock-banner').innerText(), /測試資料/);
    await page.getByTestId('search-button').click();
    await cards(page).first().waitFor();
    const first = await page.getByTestId('store-card').first().innerText();
    assert.match(first, /測試資料/);
    assert.match(first, /評分 \d\.\d（測試資料）/);
    assert.ok(!requests.some((u) => /supabase/i.test(u)), '不應有 Supabase 請求');
    await context.close();
  });

  it('15. 收藏後重新整理仍在收藏頁', async () => {
    const { context, page } = await open();
    await page.getByTestId('search-button').click();
    await cards(page).first().click();
    const dialog = page.getByRole('dialog');
    const title = await dialog.getByRole('heading', { level: 2 }).innerText();
    await dialog.getByTestId('fav-toggle').click();
    assert.equal(await dialog.getByTestId('fav-toggle').getAttribute('aria-pressed'), 'true');
    await dialog.getByRole('button', { name: '回結果' }).click();
    await page.getByTestId('nav-favorites').click();
    await page.getByTestId('fav-list').waitFor();
    await page.reload();
    await page.getByTestId('fav-list').waitFor();
    assert.match(page.url(), /view=favorites/);
    assert.equal(await page.getByTestId('fav-count').innerText(), '共 1 道');
    assert.match(await page.getByTestId('fav-card').first().innerText(), new RegExp(title));
    await context.close();
  });

  it('16. 條件極嚴 (預算 30、500m、評分 4.5) 顯示 Empty State，點放寬按鈕後有結果', async () => {
    const { context, page } = await open();
    await page.getByRole('button', { name: '自訂', exact: true }).click();
    await page.getByLabel('自訂預算金額').fill('30');
    await page.getByTestId('search-button').click();
    await page.getByTestId('budget-value').waitFor();
    assert.equal(await page.getByTestId('budget-value').innerText(), '$30');
    await openDrawer(page);
    await page.getByRole('button', { name: '距離 500m' }).click();
    await page.getByRole('group', { name: '最低評分' }).getByRole('button', { name: '4.5' }).click();
    await closeDrawer(page);
    await page.getByTestId('empty-state').waitFor();
    assert.match(await page.getByTestId('empty-state').innerText(), /查無資料/);
    const relax = page.getByTestId('relax-budget');
    const text = await relax.innerText();
    const n = Number(/放寬後有 (\d+) 筆/.exec(text)?.[1]);
    assert.ok(n > 0, `預算 +50 放寬後應有結果，實際文字：${text}`);
    await relax.click();
    await cards(page).first().waitFor();
    assert.equal(await count(page), n, '放寬後筆數應與提示相符');
    assert.equal(await page.getByTestId('budget-value').innerText(), '$80');
    await context.close();
  });

  it('17. 成功標準流程：首頁→選肉類→搜尋→開詳情，≤ 3 次點擊，全程 < 10 秒', async () => {
    const t0 = Date.now();
    const { context, page } = await open();
    let clicks = 0;
    const click = async (loc) => {
      clicks += 1;
      await loc.click();
    };
    await click(page.getByRole('button', { name: '類型 肉類' }));
    await click(page.getByTestId('search-button'));
    await cards(page).first().waitFor();
    await click(cards(page).first());
    await page.getByRole('dialog').waitFor();
    const elapsed = Date.now() - t0;
    assert.ok(clicks <= 3, `點擊次數 ${clicks}`);
    assert.ok(elapsed < 10_000, `耗時 ${elapsed}ms`);
    console.log(`    -> 點擊 ${clicks} 次，從開啟頁面到詳情 ${elapsed} ms`);
    await context.close();
  });

  it('17b. 首頁預設值 (100 元／不限／500 公尺) 直接按搜尋即有結果，價格皆 <= 100', async () => {
    const { context, page } = await open();
    await page.getByTestId('search-button').click();
    await cards(page).first().waitFor();
    const prices = await page.getByTestId('card-price').allInnerTexts();
    assert.ok(prices.length > 0);
    assert.ok(prices.every((p) => num(p) <= 100));
    await context.close();
  });

  it('18. 不使用餐點示意圖：結果、詳情都沒有 <img>／示意插圖，也沒有「圖片為示意插圖」字樣', async () => {
    const context = await browser.newContext({ viewport: VIEWPORT });
    await blockFonts(context);
    // 即使資料帶有圖片網址 (舊測試用的注入點) 也不會顯示
    await context.addInitScript((u) => {
      window.__PRICEEATS_TEST_IMAGE_URL = u;
    }, 'https://upload.wikimedia.org/ok.png');
    const page = await context.newPage();
    await page.goto(server.url + '?view=results');
    await cards(page).first().waitFor();
    assert.equal(await page.locator('img, svg[data-testid="food-illustration"], [data-testid="food-illustration"]').count(), 0);
    await cards(page).first().click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('img, [data-testid="food-illustration"]').count(), 0);
    assert.ok(!/示意/.test(await page.locator('body').innerText()), '不應有「示意」字樣');
    await context.close();
  });

  it('19. 網址還原狀態：重新整理後篩選條件與開啟的詳情都還在', async () => {
    const { context, page } = await open('?view=results&budget=150&cat=%E8%82%89%E9%A1%9E&dist=2000&sort=distance');
    await cards(page).first().waitFor();
    assert.equal(await page.getByTestId('budget-value').innerText(), '$150');
    assert.match(await page.getByTestId('result-summary').innerText(), /先列最近的/);
    await openDrawer(page);
    assert.equal(await page.getByRole('button', { name: '最近', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: '距離 2km' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: '類型 肉類' }).getAttribute('aria-pressed'), 'true');
    await closeDrawer(page);
    await cards(page).first().click();
    await page.getByRole('dialog').waitFor();
    assert.match(page.url(), /food=/);
    await page.reload();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: '回結果' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await context.close();
  });

  it('20. 改條件即時更新 (不需再按搜尋)；詳情有導航連結、菜單照片空狀態與價格歷史', async () => {
    const { context, page } = await open('?view=results');
    await cards(page).first().waitFor();
    const before = await count(page);
    await openDrawer(page);
    await page.getByRole('button', { name: '$200', exact: true }).click();
    const after = await count(page);
    assert.ok(after > before, `預算變大筆數應增加 (${before} -> ${after})`);
    assert.equal(num(await page.getByTestId('drawer-apply').innerText()), after, '抽屜按鈕的筆數要與結果一致');
    await closeDrawer(page);
    await cards(page).first().click();
    const dialog = page.getByRole('dialog');
    const href = await dialog.getByRole('link', { name: /導航過去/ }).getAttribute('href');
    assert.match(href, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=\d+\.\d+,\d+\.\d+$/);
    assert.match(await dialog.innerText(), /尚無菜單照片|菜單照片未公開/);
    assert.match(await dialog.innerText(), /價格歷史/);
    assert.ok(await dialog.getByRole('button', { name: '分享' }).isVisible(), 'M5：餐點頁底部有分享按鈕');
    await context.close();
  });

  it('20b. 餐點頁：這家店 N 元內還有 (最多 5 道、皆 <= 預算)、多加一點預算 (最多 3 道、預算 < 價格 <= 預算+20)；點同店餐點可切換', async () => {
    const { context, page } = await open('?view=results&budget=100&dist=5000');
    await cards(page).first().waitFor();
    // 找一道同店還有其他預算內餐點的餐點
    const stores = page.getByTestId('store-card');
    const n = await stores.count();
    let found = false;
    for (let i = 0; i < n && !found; i++) {
      if ((await stores.nth(i).getByTestId('food-card').count()) >= 2) {
        await stores.nth(i).getByTestId('food-card').first().click();
        found = true;
      }
    }
    assert.ok(found, '應有同店至少 2 道的店');
    const dialog = page.getByRole('dialog');
    const section = dialog.getByTestId('same-store');
    await section.waitFor();
    assert.match(await section.innerText(), /這家店 100 元內還有/);
    const rows = section.getByRole('button');
    const total = await rows.count();
    assert.ok(total >= 1 && total <= 8, `列數 ${total}`);
    const prices = (await section.locator('.amount').allInnerTexts()).map(num);
    const within = prices.filter((p) => p <= 100);
    const extra = prices.filter((p) => p > 100);
    assert.ok(within.length <= 5, '預算內最多 5 道');
    assert.ok(extra.length <= 3 && extra.every((p) => p <= 120), '多加預算最多 3 道且 <= 預算+20');
    const first = rows.first();
    const label = (await first.getAttribute('aria-label')).split(' ')[0];
    await first.click();
    await dialog.getByRole('heading', { level: 3 }).first().waitFor();
    assert.match(await dialog.innerText(), new RegExp(label));
    await context.close();
  });

  it('21. 價格回報：寫入待確認，不改餐點價格', async () => {
    const { context, page } = await open('?view=results');
    await cards(page).first().click();
    const dialog = page.getByRole('dialog');
    const priceBefore = await dialog.getByTestId('detail-price').innerText();
    const price = num(priceBefore);
    await dialog.getByRole('button', { name: '回報新價格' }).click();
    await dialog.getByText('價格已調漲').click();
    await dialog.getByLabel('新價格').fill(String(price - 5));
    await dialog.getByRole('button', { name: '送出回報' }).click();
    assert.match(await dialog.getByRole('alert').innerText(), /高於/);
    await dialog.getByLabel('新價格').fill(String(price + 20));
    await dialog.getByRole('button', { name: '送出回報' }).click();
    assert.equal(await dialog.getByTestId('report-sent').innerText(), '已收到，待確認');
    assert.equal(await dialog.getByTestId('detail-price').innerText(), priceBefore);
    assert.match(await dialog.getByTestId('price-history').innerText(), /待確認/);
    await context.close();
  });

  it('22. 地圖：標記顯示最低價、點標記開店內清單→詳情；圖磚失敗有提示且清單模式可用', async () => {
    const context = await browser.newContext({ viewport: VIEWPORT });
    await blockFonts(context);
    await context.route('https://tile.openstreetmap.org/**', (r) => r.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(server.url);
    await page.getByTestId('nav-map').click();
    await page.locator('.price-marker').first().waitFor();
    const markers = await page.locator('.price-marker').count();
    assert.ok(markers > 0);
    assert.match(await page.locator('.price-marker').first().innerText(), /^\$\d+$/);
    await page.getByTestId('tile-error').waitFor();
    await page.locator('.price-marker').first().click();
    await page.getByTestId('map-selected').waitFor();
    await page.getByTestId('map-selected').getByRole('button').first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: '返回' }).click();
    await page.getByRole('button', { name: '清單模式' }).click();
    await page.getByTestId('map-list').waitFor();
    assert.ok((await page.getByTestId('map-list').getByRole('button').count()) > 0);
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('23. 傳菜單：檔案驗證、OCR 未設定時切到人工輸入、不顯示辨識成功、送出為待確認', async () => {
    const { context, page } = await open();
    await page.getByTestId('nav-upload').click();
    const file = page.getByLabel('選擇菜單照片');
    await file.setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    assert.match(await page.getByTestId('file-error').innerText(), /JPEG、PNG、WebP/);
    await file.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(8 * 1024 * 1024 + 1) });
    assert.match(await page.getByTestId('file-error').innerText(), /8MB/);
    await file.setInputFiles({ name: 'menu.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await page.getByTestId('menu-preview').waitFor();
    const msg = await page.getByTestId('ocr-msg').innerText();
    assert.match(msg, /尚未設定自動辨識/);
    assert.ok(!/辨識成功/.test(await page.locator('body').innerText()));
    await page.getByRole('button', { name: '送出菜單' }).click();
    const errs = await page.getByTestId('upload-errors').innerText();
    assert.match(errs, /店名|店家/);
    await page.locator('select[aria-label="現有店家"]').selectOption({ index: 1 });
    await page.getByLabel('餐點名稱 1').fill('測試便當');
    await page.getByLabel('價格 1').fill('0');
    await page.getByRole('button', { name: '送出菜單' }).click();
    assert.match(await page.getByTestId('upload-errors').innerText(), /價格最少 1 元/);
    await page.getByLabel('價格 1').fill('95');
    await page.getByRole('button', { name: '新增一列' }).click();
    assert.equal(await page.getByTestId('menu-row').count(), 2);
    await page.getByRole('button', { name: '送出菜單' }).click();
    assert.match(await page.getByTestId('upload-done').innerText(), /待確認/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('priceeats:menu-submissions') ?? '[]'));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].status, 'pending');
    assert.equal(stored[0].ocr_status, 'not_configured');
    await context.close();
  });

  it('24. localStorage 不可用時頁面仍正常 (收藏降級、搜尋照常)', async () => {
    const context = await browser.newContext({ viewport: VIEWPORT });
    await blockFonts(context);
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(server.url);
    await page.getByTestId('search-button').click();
    await cards(page).first().waitFor();
    await cards(page).first().click();
    await page.getByTestId('fav-toggle').click();
    await page.getByRole('button', { name: '回結果' }).click();
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('25. 1440 與 375 寬無橫向捲動', async () => {
    for (const width of [375, 1440]) {
      const { context, page } = await open('?view=results', { viewport: { width, height: 900 } });
      await cards(page).first().waitFor();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, `${width}px 寬出現橫向捲動 ${over}px`);
      await context.close();
    }
  });

  it('26. 結果以店分組：每店一張收據、最多 3 道、可展開；預設先列最貼近預算', async () => {
    const { context, page } = await open('?view=results&budget=300&dist=5000');
    await page.getByTestId('store-card').first().waitFor();
    assert.match(await page.getByTestId('result-summary').innerText(), /先列最貼近預算的/);
    const stores = page.getByTestId('store-card');
    const n = await stores.count();
    for (let i = 0; i < n; i++) {
      assert.ok((await stores.nth(i).getByTestId('food-card').count()) <= 3, '預設每店最多顯示 3 道');
      assert.match(await stores.nth(i).innerText(), /預算內/, '每張收據都蓋「預算內」章');
    }
    // 店內依價格高到低
    const prices = (await stores.first().getByTestId('card-price').allInnerTexts()).map(num);
    assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
    // 找一家有「看這家全部」的店
    const expand = page.getByTestId('store-expand').first();
    await expand.waitFor();
    assert.match(await expand.innerText(), /^看這家全部 \d+ 道$/);
    const card = page.getByTestId('store-card').filter({ has: expand }).first();
    const before = await card.getByTestId('food-card').count();
    await expand.click();
    assert.ok((await card.getByTestId('food-card').count()) > before, '展開後應顯示更多道');
    assert.equal(await card.getByTestId('store-expand').getAttribute('aria-expanded'), 'true');
    await context.close();
  });

  it('27. 也顯示多人份：預設不勾，勾選後筆數不減少', async () => {
    const { context, page } = await open('?view=results&budget=2000&dist=5000');
    await page.getByTestId('store-card').first().waitFor();
    await openDrawer(page);
    const box = page.getByLabel('也顯示多人份');
    assert.equal(await box.isChecked(), false);
    const before = await count(page);
    await box.check();
    const after = await count(page);
    assert.ok(after >= before, `勾選多人份後筆數不應減少 (${before} -> ${after})`);
    assert.match(page.url(), /multi=1/);
    await context.close();
  });
});

/** M4：手機體驗與收據風格的量測 (全部用程式量) */
const SIZES = [
  { width: 375, height: 812 },
  { width: 320, height: 640 },
];

/** 回傳目前頁面所有可見的 button／a／input／select／textarea 中，寬或高 < 44px 的 */
async function smallTargets(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      if (el.closest('.leaflet-container')) continue; // 地圖圖磚的版權連結不在此量測
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 43.5 || r.height < 43.5) {
        out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return out;
  });
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const size of SIZES) {
  describe(`M4 手機體驗與收據風格 (${size.width}x${size.height})`, () => {
    const o = (path = '') => open(path, { viewport: size });

    it('首頁表單在 DOMContentLoaded 後 1 秒內可點 (不等資料、不等字型)', async () => {
      const context = await browser.newContext({ viewport: size, locale: 'zh-TW' });
      // 字型請求故意卡住：字型沒到也不能擋住操作
      await context.route(/fonts\.(googleapis|gstatic)\.com/, () => {});
      const page = await context.newPage();
      await page.goto(server.url, { waitUntil: 'domcontentloaded' });
      const t0 = Date.now();
      const quick = page.getByRole('button', { name: '$150', exact: true });
      let pressed = false;
      while (Date.now() - t0 < 1000 && !pressed) {
        if (await quick.isVisible()) {
          await quick.click({ timeout: 500 }).catch(() => {});
          pressed = (await quick.getAttribute('aria-pressed')) === 'true';
        }
        if (!pressed) await page.waitForTimeout(30);
      }
      assert.ok(pressed, `DOMContentLoaded 後 1 秒內應可點 $150 並看到選中，實際 ${Date.now() - t0} ms`);
      assert.match(await page.getByTestId('search-button').innerText(), /找 150 元內的餐點/);
      await context.close();
    });

    it('無橫向捲動：首頁、結果、改條件抽屜、餐點頁、地圖、傳菜單、收藏', async () => {
      const { context, page } = await o('?view=results&budget=300&dist=5000');
      const check = async (name) => assert.ok((await overflowX(page)) <= 0, `${name}：scrollWidth 超出 innerWidth ${await overflowX(page)}px`);
      await page.getByTestId('store-card').first().waitFor();
      await check('結果');
      await page.goto(server.url + '?view=results&budget=2000&dist=5000');
      await page.getByTestId('store-card').first().waitFor();
      await check('結果 (預算 2000)');
      await openDrawer(page);
      await check('抽屜');
      await closeDrawer(page);
      await cards(page).first().click();
      await page.getByRole('dialog').waitFor();
      await check('餐點頁');
      await page.getByRole('button', { name: '回報新價格' }).click();
      await check('餐點頁 (回報表單)');
      await page.getByRole('button', { name: '回結果' }).click();
      await page.goto(server.url);
      await page.getByTestId('search-button').waitFor();
      await check('首頁');
      await page.getByTestId('center-button').click();
      await check('首頁 (出發點面板)');
      for (const id of ['nav-map', 'nav-upload', 'nav-favorites']) {
        await page.getByTestId(id).click();
        await page.waitForTimeout(300);
        await check(id);
      }
      await context.close();
    });

    it('所有 button／a／input 寬高 >= 44px：首頁、結果、抽屜、餐點頁、收藏、傳菜單', async () => {
      const { context, page } = await o();
      const report = {};
      report['首頁'] = await smallTargets(page);
      await page.getByTestId('center-button').click();
      report['首頁 (出發點面板)'] = await smallTargets(page);
      await page.getByRole('button', { name: '自訂', exact: true }).click();
      report['首頁 (自訂預算)'] = await smallTargets(page);
      await page.goto(server.url + '?view=results&budget=2000&dist=5000');
      await page.getByTestId('store-card').first().waitFor();
      report['結果'] = await smallTargets(page);
      await openDrawer(page);
      report['抽屜'] = await smallTargets(page);
      await closeDrawer(page);
      await cards(page).first().click();
      await page.getByRole('dialog').waitFor();
      report['餐點頁'] = await smallTargets(page);
      await page.getByRole('button', { name: '回報新價格' }).click();
      report['餐點頁 (回報表單)'] = await smallTargets(page);
      await page.getByTestId('fav-toggle').click();
      await page.getByRole('button', { name: '回結果' }).click();
      await page.getByTestId('nav-favorites').click();
      await page.getByTestId('fav-list').waitFor();
      report['收藏'] = await smallTargets(page);
      await page.getByTestId('nav-upload').click();
      await page.getByLabel('選擇菜單照片').waitFor({ state: 'attached' });
      report['傳菜單'] = await smallTargets(page);
      const bad = Object.entries(report).filter(([, v]) => v.length > 0);
      assert.deepEqual(bad, [], '觸控目標小於 44px');
      await context.close();
    });

    it('選中的類型自動捲到可見位置 (首頁類型列)', async () => {
      const { context, page } = await o('?cat=%E8%87%AA%E5%8A%A9%E9%A4%90');
      const chip = page.getByRole('button', { name: '類型 自助餐' });
      await chip.waitFor();
      await page.waitForTimeout(100);
      const ok = await page.evaluate(() => {
        const box = document.querySelector('[data-testid="category-chips"]');
        const el = box.querySelector('[aria-pressed="true"]');
        const b = box.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return r.left >= b.left - 1 && r.right <= b.right + 1 && box.scrollLeft > 0;
      });
      assert.ok(ok, '選中的「自助餐」應已捲進可見範圍');
      await context.close();
    });

    it('結果卡不溢出：長店名截斷、金額固定靠右可見', async () => {
      const { context, page } = await o('?view=results&budget=2000&dist=5000');
      await page.getByTestId('store-card').first().waitFor();
      await page.evaluate(() => {
        const h = document.querySelector('[data-testid="store-card"] h2');
        h.textContent = '一間名字非常非常非常非常非常非常非常非常長的餐廳';
      });
      const res = await page.evaluate(() => {
        const vw = window.innerWidth;
        const bad = [];
        for (const card of document.querySelectorAll('[data-testid="store-card"]')) {
          const cr = card.getBoundingClientRect();
          if (cr.right > vw + 0.5 || cr.left < -0.5) bad.push('card');
          for (const el of card.querySelectorAll('[data-testid="card-price"], .amount')) {
            const r = el.getBoundingClientRect();
            if (r.right > cr.right + 0.5 || r.width === 0) bad.push('price');
          }
        }
        const h = document.querySelector('[data-testid="store-card"] h2');
        return { bad, truncated: h.scrollWidth > h.clientWidth };
      });
      assert.deepEqual(res.bad, []);
      assert.ok(res.truncated, '過長店名應被截斷');
      await context.close();
    });
  });
}

describe('M4 第一屏 (375x812)', () => {
  it('結果頁第一屏 >= 2 家店且 >= 5 道餐點 (收據卡較高時的驗收標準)', async () => {
    const { context, page } = await open('?view=results&budget=300&dist=5000');
    await page.getByTestId('store-card').first().waitFor();
    const r = await page.evaluate(() => {
      const nav = document.querySelector('nav').getBoundingClientRect().top;
      const vis = (el) => {
        const b = el.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= nav;
      };
      return {
        stores: [...document.querySelectorAll('[data-testid="store-card"]')].filter(vis).length,
        dishes: [...document.querySelectorAll('[data-testid="food-card"]')].filter(vis).length,
      };
    });
    assert.ok(r.stores >= 2, `第一屏完整可見的店 ${r.stores}`);
    assert.ok(r.dishes >= 5, `第一屏完整可見的餐點 ${r.dishes}`);
    console.log(`    -> 第一屏：${r.stores} 家店、${r.dishes} 道餐點`);
    await context.close();
  });

  it('整站套用收據風格：底色 ground、卡片 paper 無圓角、字型 stack 含 Noto Sans TC／IBM Plex Mono、導覽四項文字', async () => {
    const { context, page } = await open('?view=results');
    await page.getByTestId('store-card').first().waitFor();
    const s = await page.evaluate(() => {
      const cs = (el, p) => getComputedStyle(el)[p];
      const card = document.querySelector('[data-testid="store-card"]');
      return {
        body: cs(document.body, 'backgroundColor'),
        card: cs(card, 'backgroundColor'),
        radius: cs(card, 'borderTopLeftRadius'),
        font: cs(document.body, 'fontFamily'),
        mono: cs(card.querySelector('.amount'), 'fontFamily'),
        nav: [...document.querySelectorAll('nav button')].map((b) => b.textContent.trim()),
        active: cs(document.querySelector('nav [aria-current="page"]'), 'color'),
      };
    });
    assert.equal(s.body, 'rgb(213, 222, 230)');
    assert.equal(s.card, 'rgb(251, 251, 247)');
    assert.equal(s.radius, '0px');
    assert.match(s.font, /Noto Sans TC/);
    assert.match(s.mono, /IBM Plex Mono/);
    assert.deepEqual(s.nav, ['找餐點', '地圖', '傳菜單', '收藏']);
    assert.equal(s.active, 'rgb(210, 51, 43)');
    await context.close();
  });

  it('M5-小修 改條件抽屜：類型單列橫向滑動，兩個勾選項在 375x812 不捲動就看得到', async () => {
    const { context, page } = await open('?view=results&cat=%E6%B5%B7%E9%AE%AE');
    await page.getByTestId('store-card').first().waitFor().catch(() => {});
    await openDrawer(page);
    const r = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"][aria-label="改條件"]');
      const scroller = dlg.querySelector('.overflow-y-auto');
      const sr = scroller.getBoundingClientRect();
      const checks = [...dlg.querySelectorAll('input[type="checkbox"]')].map((c) => c.closest('label').getBoundingClientRect());
      const chips = dlg.querySelector('[data-testid="category-chips"]');
      const pressed = chips.querySelector('[aria-pressed="true"]').getBoundingClientRect();
      const cr = chips.getBoundingClientRect();
      const buttons = [...chips.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top));
      return {
        checks: checks.map((c) => ({ top: c.top, bottom: c.bottom })),
        scrollerTop: sr.top,
        scrollerBottom: sr.bottom,
        scrollable: scroller.scrollHeight - scroller.clientHeight,
        oneRow: new Set(buttons).size === 1,
        chipsScrollable: chips.scrollWidth > chips.clientWidth,
        pressedVisible: pressed.left >= cr.left - 1 && pressed.right <= cr.right + 1,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    assert.equal(r.checks.length, 2);
    for (const c of r.checks) assert.ok(c.top >= r.scrollerTop && c.bottom <= r.scrollerBottom + 0.5, `勾選項未捲動就要在可視範圍內 ${JSON.stringify({ c, r })}`);
    assert.ok(r.oneRow, '類型單列');
    assert.ok(r.chipsScrollable, '類型可橫向滑動');
    assert.ok(r.pressedVisible, '選中的類型自動捲入可見');
    assert.ok(!r.pageOverflow, '無橫向捲動');
    await context.close();
  });

  it('M5-小修 步行時間與抽屜選項文字；預設距離 500m；餐點頁價格更新只有年月', async () => {
    const { context, page } = await open('?view=results&budget=200');
    await cards(page).first().waitFor();
    const head = await page.getByTestId('center-text').innerText();
    assert.match(head, /500m$/, '頁首維持公尺');
    const dist = await page.getByTestId('store-card').first().locator('.receipt-head .amount').innerText();
    assert.match(dist, /^(走路約\d+分|\d+\.\dkm)$/);
    await openDrawer(page);
    const g = page.getByRole('group', { name: '走多遠' });
    assert.equal(await g.getByRole('button', { name: '距離 500m' }).innerText(), '走路 7 分（500m）');
    assert.equal(await g.getByRole('button', { name: '距離 1km' }).innerText(), '走路 14 分（1km）');
    assert.equal(await g.getByRole('button', { name: '距離 2km' }).innerText(), '2km');
    assert.equal(await g.getByRole('button', { name: '距離 5km' }).innerText(), '5km');
    assert.equal(await g.getByRole('button', { name: '距離 500m' }).getAttribute('aria-pressed'), 'true');
    await closeDrawer(page);
    await cards(page).first().click();
    const dialog = page.getByRole('dialog');
    const row = dialog.locator('dt', { hasText: '價格更新' }).locator('xpath=following-sibling::dd');
    const t = (await row.innerText()).trim();
    assert.ok(/^(\d{4}\/\d{2}(（舊資料）)?|尚未驗證)$/.test(t), `價格更新：${t}`);
    assert.ok(!/更新$/.test(t));
    await context.close();
  });

  it('M5-1 分享：有 navigator.share 就呼叫 (連結含目前條件＋ref=share)；沒有就複製連結', async () => {
    const { context, page } = await open('?view=results&budget=150&dist=1000');
    await cards(page).first().waitFor();
    await page.evaluate(() => {
      window.__shared = null;
      navigator.share = async (d) => {
        window.__shared = d;
      };
    });
    await page.getByTestId('share-results').click();
    const d = await page.evaluate(() => window.__shared);
    assert.ok(d, '呼叫了 navigator.share');
    const u = new URL(d.url);
    assert.equal(u.searchParams.get('ref'), 'share');
    assert.equal(u.searchParams.get('budget'), '150');
    assert.equal(u.searchParams.get('dist'), '1000');
    assert.match(d.text, /^.+ 150 元內有 \d+ 道，看看今天吃什麼$/);
    assert.equal(Number(d.text.match(/有 (\d+) 道/)[1]), await count(page), '分享文字的筆數＝畫面筆數');
    // 沒有 navigator.share：複製連結
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      window.__copied = null;
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => void (window.__copied = t) }, configurable: true });
    });
    await page.getByTestId('share-results').click();
    assert.match(await page.evaluate(() => window.__copied), /[?&]ref=share/);
    assert.match(await page.getByTestId('share-results').innerText(), /已複製連結/);
    // 餐點頁
    await cards(page).first().click();
    const dialog = page.getByRole('dialog');
    await page.evaluate(() => {
      window.__shared = null;
      Object.defineProperty(navigator, 'share', { value: async (x) => void (window.__shared = x), configurable: true });
    });
    const btn = dialog.getByRole('button', { name: '分享' });
    const nav = dialog.getByRole('link', { name: /導航過去/ });
    const bb = await btn.boundingBox();
    const nb = await nav.boundingBox();
    assert.ok(bb.x > nb.x + nb.width - 1, '分享在導航右側');
    assert.ok(Math.abs(nb.width / bb.width - 2) < 0.15, `2fr:1fr (${nb.width}:${bb.width})`);
    assert.ok(bb.height >= 44 && nb.height >= 44);
    await btn.click();
    const d2 = await page.evaluate(() => window.__shared);
    assert.match(d2.text, / \d+ 元$/);
    assert.equal(new URL(d2.url).searchParams.get('ref'), 'share');
    assert.ok(new URL(d2.url).searchParams.get('food'), '餐點頁連結帶 food');
    await context.close();
  });

  it('M5-1 帶 ref=share 的網址：搜尋結果與沒帶 ref 完全相同', async () => {
    const a = await open('?view=results&budget=120&dist=1000');
    await cards(a.page).first().waitFor();
    const na = await count(a.page);
    await a.context.close();
    const b = await open('?view=results&budget=120&dist=1000&ref=share');
    await cards(b.page).first().waitFor();
    assert.equal(await count(b.page), na);
    await b.context.close();
  });

});

/** M6：說明頁與入口頁 (靜態頁，不載入 App) */
async function openStatic(path, size = VIEWPORT) {
  const context = await browser.newContext({ viewport: size, locale: 'zh-TW' });
  await blockFonts(context);
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().startsWith(server.url) && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  const res = await page.goto(server.url + path.replace(/^\//, ''));
  await page.locator('h1').waitFor();
  return { context, page, errors, failed, status: res.status() };
}

/** 文字對背景的對比 (WCAG)：回傳低於 4.5 的元素 */
async function lowContrast(page) {
  return page.evaluate(() => {
    const parse = (c) => c.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c.length < 4 || c[3] > 0.99) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const bad = [];
    for (const el of document.querySelectorAll('h1,h2,p,li,a,span,dt,dd')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const fg = parse(getComputedStyle(el).color).slice(0, 3);
      const [a, b] = [lum(fg), lum(bgOf(el))];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 4.5) bad.push(`${el.tagName} "${el.textContent.trim().slice(0, 20)}" ${ratio.toFixed(2)}`);
    }
    return bad;
  });
}

for (const size of SIZES) {
  describe(`M6 說明頁與入口頁 (${size.width}x${size.height})`, () => {
    const PAGES = ['about/source', 'about/privacy', 'about/report', 'area/nangang/100', 'area/zhongxiao/50', 'area/xizhi/150'];

    it('每頁：200、有 h1、資產 (CSS／JS) 都載得到、無頁面錯誤、無橫向捲動、觸控目標 >= 44px、文字對比 >= 4.5', async () => {
      for (const p of PAGES) {
        const { context, page, errors, failed, status } = await openStatic(p, size);
        assert.equal(status, 200, p);
        assert.ok((await page.locator('h1').innerText()).trim().length > 0, `${p} h1`);
        assert.deepEqual(failed, [], `${p} 有資源 404`);
        assert.ok((await overflowX(page)) <= 0, `${p} 橫向捲動`);
        assert.deepEqual(await smallTargets(page), [], `${p} 觸控目標小於 44px`);
        assert.deepEqual(await lowContrast(page), [], `${p} 對比不足`);
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        assert.equal(bg, 'rgb(213, 222, 230)', `${p} 樣式表有載入 (ground 底色)`);
        assert.deepEqual(errors, [], p);
        await context.close();
      }
    });
  });
}

describe('M6 說明頁與入口頁', () => {
  it('首頁頁尾三個說明頁連結：點了到對應頁，頁尾也有連結，可回首頁', async () => {
    const { context, page } = await open();
    const footer = page.getByTestId('site-footer');
    await footer.waitFor();
    assert.deepEqual(await footer.locator('a').allInnerTexts(), ['資料來源', '隱私', '回報與聯絡']);
    await footer.getByRole('link', { name: '隱私' }).click();
    await page.waitForURL(/\/about\/privacy$/);
    assert.match(await page.locator('h1').innerText(), /隱私/);
    assert.equal(await page.getByTestId('site-footer').locator('a').count(), 3);
    await page.getByRole('link', { name: 'PriceEats' }).click();
    await page.getByTestId('search-button').waitFor();
    await context.close();
  });

  it('回報頁：聯絡 Email 尚未提供時顯示「聯絡方式準備中」，頁面沒有 Email 位址', async () => {
    const { context, page } = await openStatic('about/report');
    assert.equal((await page.getByTestId('contact').innerText()).trim(), '聯絡方式準備中');
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(await page.locator('main').innerText()));
    assert.equal(await page.locator('a[href^="mailto:"]').count(), 0);
    await context.close();
  });

  it('入口頁：H1 與 title 各自獨立；店數／餐點數與統計日期；開始搜尋進結果頁並帶預算與座標', async () => {
    const { context, page } = await openStatic('area/nangang/100');
    assert.equal((await page.locator('h1').innerText()).trim(), '南港車站 100 元內吃什麼');
    assert.match(await page.title(), /^南港車站 100 元內吃什麼｜PriceEats$/);
    assert.match(await page.getByTestId('area-stat').innerText(), /^\d+ 家店、\d+ 道餐點\s+資料統計至 \d{4}\/\d{2}\/\d{2}$/);
    await page.getByTestId('start-search').click();
    await page.getByTestId('result-summary').waitFor();
    const u = new URL(page.url());
    assert.equal(u.searchParams.get('view'), 'results');
    assert.equal(u.searchParams.get('budget'), '100');
    assert.ok(u.searchParams.get('lat') && u.searchParams.get('lng'));
    assert.match(await page.getByTestId('budget-value').innerText(), /\$100/);
    await context.close();
  });

  it('不存在的入口頁 (預算 200、未知區域) 回 404', async () => {
    for (const p of ['area/nangang/200', 'area/nowhere/100']) {
      const context = await browser.newContext({ viewport: VIEWPORT });
      const res = await (await context.newPage()).goto(server.url + p);
      assert.equal(res.status(), 404, p);
      await context.close();
    }
  });

  it('sitemap.xml 與 robots.txt 可讀取', async () => {
    const context = await browser.newContext();
    const sm = await context.request.get(server.url + 'sitemap.xml');
    assert.equal(sm.status(), 200);
    assert.equal(((await sm.text()).match(/<loc>/g) ?? []).length, 28);
    const rb = await context.request.get(server.url + 'robots.txt');
    assert.equal(rb.status(), 200);
    assert.match(await rb.text(), /Sitemap: https?:\/\/\S+\/sitemap\.xml/);
    await context.close();
  });

  it('傳菜單頁上方有「為什麼傳、傳了之後」說明', async () => {
    const { context, page } = await open();
    await page.getByTestId('nav-upload').click();
    const t = await page.getByTestId('upload-intro').innerText();
    assert.match(t, /為什麼傳/);
    assert.match(t, /傳了之後/);
    assert.match(t, /待確認/);
    await context.close();
  });

  it('M5 追加：0 筆時頁首只寫「0 道」；有結果時仍寫「N 道，先列…」', async () => {
    const a = await open('?view=results&budget=1');
    await a.page.getByTestId('empty-state').waitFor();
    assert.equal((await a.page.getByTestId('result-summary').innerText()).trim(), '0 道');
    await a.context.close();
    const b = await open('?view=results&budget=200');
    await cards(b.page).first().waitFor();
    assert.match(await b.page.getByTestId('result-summary').innerText(), /^\d+ 道，先列最貼近預算的/);
    await b.context.close();
  });

  it('M5 追加：「走路約N分」數字前後沒有空格', async () => {
    const { context, page } = await open('?view=results&budget=200');
    await cards(page).first().waitFor();
    const texts = await page.getByTestId('store-card').locator('.receipt-head .amount').allInnerTexts();
    assert.ok(texts.length > 0);
    for (const t of texts) assert.ok(/^(走路約\d+分|\d+\.\dkm)$/.test(t), t);
    await context.close();
  });
});
