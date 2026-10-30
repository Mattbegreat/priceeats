// Playwright E2E：對 build:demo 的 out/ 起靜態伺服器，chromium、390x844
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

let server;
let browser;
const VIEWPORT = { width: 390, height: 844 };
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

before(async () => {
  server = await startServer();
  browser = await chromium.launch({ args: ['--no-sandbox'] });
});
after(async () => {
  await browser?.close();
  await server?.close();
});

/** 開新 context/page，記錄頁面錯誤 (忽略外部資源載入失敗，例如沒有網路時的地圖圖磚) */
async function open(path = '', opts = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'zh-TW', ...opts });
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

describe('E2E (build:demo 的 out/，chromium 390x844)', () => {
  it('13. 拒絕 GPS 權限仍能搜尋並出現結果與提示文字', async () => {
    const { context, page, errors } = await open('', { permissions: [] });
    await page.getByRole('button', { name: '使用目前位置' }).click();
    const note = page.getByTestId('location-note');
    await note.waitFor();
    assert.match(await note.innerText(), /預設位置：台北車站/);
    await page.getByTestId('search-button').click();
    await cards(page).first().waitFor();
    assert.ok((await cards(page).count()) > 0, '應有結果');
    assert.match(await page.getByTestId('location-note').innerText(), /預設位置：台北車站/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('14. 沒有任何環境變數時正常使用模擬資料 (標示測試資料、不連 Supabase)', async () => {
    const { context, page, requests } = await open();
    assert.match(await page.getByTestId('mock-banner').innerText(), /測試資料/);
    await page.getByTestId('search-button').click();
    await cards(page).first().waitFor();
    const first = await cards(page).first().innerText();
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
    await dialog.getByRole('button', { name: '關閉詳情' }).click();
    await page.getByTestId('nav-favorites').click();
    await page.getByTestId('fav-list').waitFor();
    await page.reload();
    await page.getByTestId('fav-list').waitFor();
    assert.match(page.url(), /view=favorites/);
    assert.equal(await page.getByTestId('fav-count').innerText(), '共 1 道');
    assert.match(await cards(page).first().innerText(), new RegExp(title));
    await context.close();
  });

  it('16. 條件極嚴 (預算 30、500m、評分 4.5) 顯示 Empty State，點放寬按鈕後有結果', async () => {
    const { context, page } = await open();
    await page.getByLabel('預算滑桿').focus();
    await page.keyboard.press('Home');
    assert.equal(await page.getByTestId('budget-value').innerText(), '$30');
    await page.getByRole('button', { name: '距離 500m' }).click();
    await page.getByTestId('search-button').click();
    await page.getByLabel('最低評分').selectOption('4.5');
    await page.getByTestId('empty-state').waitFor();
    const relax = page.getByTestId('relax-budget');
    const text = await relax.innerText();
    const n = Number(/放寬後有 (\d+) 筆/.exec(text)?.[1]);
    assert.ok(n > 0, `預算 +50 放寬後應有結果，實際文字：${text}`);
    await relax.click();
    await cards(page).first().waitFor();
    assert.equal(await cards(page).count(), n, '放寬後筆數應與提示相符');
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

  it('17b. 首頁預設值 (100 元／不限／1 公里) 直接按搜尋即有結果，價格皆 <= 100', async () => {
    const { context, page } = await open();
    await page.getByTestId('search-button').click();
    await cards(page).first().waitFor();
    const prices = await page.getByTestId('card-price').allInnerTexts();
    assert.ok(prices.length > 0);
    assert.ok(prices.every((p) => Number(p.replace('$', '')) <= 100));
    await context.close();
  });

  it('18. 圖片網址失效時顯示 fallback，不出現破圖；圖片有效時正常顯示', async () => {
    const BAD = 'https://upload.wikimedia.org/wikipedia/commons/x/xx/Not_Exist_For_Test.jpg';
    const context = await browser.newContext({ viewport: VIEWPORT });
    await context.addInitScript((u) => {
      window.__PRICEEATS_TEST_IMAGE_URL = u;
    }, BAD);
    await context.route('https://upload.wikimedia.org/**', (r) => r.fulfill({ status: 404, body: 'nope' }));
    const page = await context.newPage();
    await page.goto(server.url + '?view=results');
    await cards(page).first().waitFor();
    // 讓所有 lazy 圖片立刻載入 (離開畫面的圖片預設不會載入，也就不會觸發錯誤)
    await page.evaluate(() => document.querySelectorAll('img').forEach((i) => (i.loading = 'eager')));
    await page.waitForTimeout(1000);
    const n = await cards(page).count();
    assert.equal(await page.locator('[data-testid="food-card"] img').count(), 0, '失效圖片不應留下 <img>');
    assert.equal(await page.locator('[data-testid="food-card"] [data-testid="food-illustration"]').count(), n);
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => !i.complete || i.naturalWidth === 0).length);
    assert.equal(broken, 0, '不得有破圖');
    await context.close();

    // 對照組：圖片有效時真的顯示照片 (證明 fallback 不是永遠啟用)
    const ctx2 = await browser.newContext({ viewport: VIEWPORT });
    await ctx2.addInitScript((u) => {
      window.__PRICEEATS_TEST_IMAGE_URL = u;
    }, 'https://upload.wikimedia.org/ok.png');
    await ctx2.route('https://upload.wikimedia.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 }));
    const p2 = await ctx2.newPage();
    await p2.goto(server.url + '?view=results');
    await cards(p2).first().waitFor();
    await p2.waitForFunction(() => document.querySelector('[data-testid="food-card"] img')?.naturalWidth > 0);
    assert.equal(await p2.locator('[data-testid="food-card"] [data-testid="food-illustration"]').count(), 0);
    await ctx2.close();
  });

  it('19. 網址還原狀態：重新整理後篩選條件與開啟的詳情都還在', async () => {
    const { context, page } = await open('?view=results&budget=150&cat=%E8%82%89%E9%A1%9E&dist=2000&sort=distance');
    await cards(page).first().waitFor();
    assert.equal(await page.getByTestId('budget-value').innerText(), '$150');
    assert.equal(await page.getByLabel('排序').inputValue(), 'distance');
    assert.equal(await page.getByLabel('距離').inputValue(), '2000');
    await cards(page).first().click();
    await page.getByRole('dialog').waitFor();
    assert.match(page.url(), /food=/);
    await page.reload();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: '關閉詳情' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await context.close();
  });

  it('20. 結果頁調整篩選即時更新 (不需再按搜尋)；詳情有導航連結與菜單照片空狀態', async () => {
    const { context, page } = await open('?view=results');
    await cards(page).first().waitFor();
    const before = Number(await page.getByTestId('result-count').locator('span').innerText());
    await page.getByLabel('預算滑桿').focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    const after = Number(await page.getByTestId('result-count').locator('span').innerText());
    assert.ok(after > before, `預算變大筆數應增加 (${before} -> ${after})`);
    await cards(page).first().click();
    const dialog = page.getByRole('dialog');
    const href = await dialog.getByRole('link', { name: '用 Google 地圖導航' }).getAttribute('href');
    assert.match(href, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=\d+\.\d+,\d+\.\d+$/);
    assert.match(await dialog.innerText(), /尚無菜單照片/);
    assert.match(await dialog.innerText(), /價格歷史/);
    await context.close();
  });

  it('21. 價格回報：寫入待確認，不改餐點價格', async () => {
    const { context, page } = await open('?view=results');
    await cards(page).first().click();
    const dialog = page.getByRole('dialog');
    const priceBefore = await dialog.getByTestId('detail-price').innerText();
    const num = Number(priceBefore.replace('$', ''));
    await dialog.getByText('價格已調漲').click();
    await dialog.getByLabel('新價格').fill(String(num - 5));
    await dialog.getByRole('button', { name: '送出回報' }).click();
    assert.match(await dialog.getByRole('alert').innerText(), /高於/);
    await dialog.getByLabel('新價格').fill(String(num + 20));
    await dialog.getByRole('button', { name: '送出回報' }).click();
    assert.equal(await dialog.getByTestId('report-sent').innerText(), '已收到，待確認');
    assert.equal(await dialog.getByTestId('detail-price').innerText(), priceBefore);
    assert.match(await dialog.getByTestId('price-history').innerText(), /待確認/);
    await context.close();
  });

  it('22. 地圖：標記顯示最低價、點標記開店內清單→詳情；圖磚失敗有提示且清單模式可用', async () => {
    const context = await browser.newContext({ viewport: VIEWPORT });
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
    await page.getByRole('button', { name: '關閉詳情' }).click();
    await page.getByRole('button', { name: '清單模式' }).click();
    await page.getByTestId('map-list').waitFor();
    assert.ok((await page.getByTestId('map-list').getByRole('button').count()) > 0);
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('23. 上傳：檔案驗證、OCR 未設定時切到人工輸入、不顯示辨識成功、送出為待確認', async () => {
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
    await page.getByRole('button', { name: '關閉詳情' }).click();
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('25. 1440 與 375 寬無橫向捲動', async () => {
    for (const width of [375, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(server.url + '?view=results');
      await cards(page).first().waitFor();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, `${width}px 寬出現橫向捲動 ${over}px`);
      await context.close();
    }
  });
});
