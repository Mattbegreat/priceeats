// GA4 事件驗證 (正式資料模式)：需先用假的 Supabase 變數建置並放到 out-real/
//   NEXT_PUBLIC_SUPABASE_URL=https://pe-fixture.supabase.test NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture npm run build:demo && mv out out-real
// 以 --host-resolver-rules 把 priceeats.pages.dev 對映到本機靜態伺服器 (真的用「正式主機名」載入)，
// Supabase 與 Google 的請求全部攔截：Supabase 回固定資料，gtag.js 以替身腳本取代，collect 請求只記錄後中止，不會真的送出。
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const OUT = resolve(import.meta.dirname, '../out-real');
const HOST = 'priceeats.pages.dev';
const CATS = ['便當', '飯類', '麵食', '肉類', '海鮮', '早餐', '小吃', '自助餐'];
const catId = (i) => `00000000-0000-4000-8000-00000000c00${i + 1}`;
const NOW = new Date().toISOString();
const NANGANG = { lat: 25.0525, lng: 121.6073 };

const restaurants = [0, 1, 2].map((i) => ({
  id: `00000000-0000-4000-8000-0000000000a${i}`,
  name: `測試店${i}`,
  address: `南港路 ${i} 號`,
  latitude: NANGANG.lat + 0.001 * (i + 1),
  longitude: NANGANG.lng,
  google_place_id: null,
  google_rating: null,
  google_review_count: null,
  phone: null,
  is_test_data: false,
  created_at: NOW,
  updated_at: NOW,
}));
const foods = restaurants.flatMap((r, i) =>
  [0, 1].map((j) => ({
    id: `00000000-0000-4000-8000-0000000001${i}${j}`,
    restaurant_id: r.id,
    name: `餐點${i}${j}`,
    description: '',
    category_id: catId(2),
    price: 70 + i * 10 + j * 5,
    image_url: null,
    is_available: true,
    created_at: NOW,
    updated_at: NOW,
    food_tags: [{ food_id: `00000000-0000-4000-8000-0000000001${i}${j}`, category_id: catId(2) }],
    price_verifications: [],
  })),
);

// 替身 gtag.js：把 dataLayer 裡的 event 轉成對 google-analytics.com/g/collect 的請求 (由測試攔截後中止)
const GTAG_STUB = `(function(){
  var seen=0;
  function flush(){
    var dl=window.dataLayer||[];
    for(;seen<dl.length;seen++){
      var a=Array.prototype.slice.call(dl[seen]);
      if(a[0]==='event'){ new Image().src='https://www.google-analytics.com/g/collect?v=2&en='+encodeURIComponent(a[1])+'&p='+encodeURIComponent(JSON.stringify(a[2]||{})); }
    }
  }
  var orig=window.dataLayer.push.bind(window.dataLayer);
  window.dataLayer.push=function(){ var r=orig.apply(null,arguments); flush(); return r; };
  flush();
})();`;

let server;
let browser;
before(async () => {
  if (!existsSync(resolve(OUT, 'index.html'))) {
    console.error('找不到 out-real/index.html，請先用假 Supabase 變數建置 (見檔頭說明)');
    process.exit(2);
  }
  server = await startServer(OUT);
  const port = new URL(server.url).port;
  browser = await chromium.launch({
    args: ['--no-sandbox', `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${port},MAP localhost-gtag 127.0.0.1`],
  });
  server.port = port;
});
after(async () => {
  await browser?.close();
  await server?.close();
});

/** 開頁；回傳攔截到的 GA 事件 (name＋params)、gtag 載入網址、所有送往 Google 的請求 */
async function openReal(path, { host = HOST, session } = {}) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'zh-TW', permissions: [] });
  const cap = { events: [], gtagScripts: [], googleRequests: [], reportPosts: 0 };
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await context.route(/pe-fixture\.supabase\.test/, async (r) => {
    const u = new URL(r.request().url());
    const table = u.pathname.split('/').pop();
    if (r.request().method() === 'POST') {
      cap.reportPosts += 1;
      return r.fulfill({ status: 201, body: '' });
    }
    const rows = { categories: CATS.map((name, i) => ({ id: catId(i), name, parent_category_id: null })), restaurants, foods, menu_images: [] }[table] ?? [];
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(rows) });
  });
  await context.route(/googletagmanager\.com/, (r) => {
    cap.googleRequests.push(r.request().url());
    cap.gtagScripts.push(r.request().url());
    return r.fulfill({ status: 200, contentType: 'text/javascript', body: GTAG_STUB });
  });
  await context.route(/google-analytics\.com/, (r) => {
    const u = new URL(r.request().url());
    cap.googleRequests.push(r.request().url());
    if (u.pathname.endsWith('/collect')) cap.events.push({ name: u.searchParams.get('en'), params: JSON.parse(u.searchParams.get('p')) });
    return r.abort(); // 不真的送出
  });
  if (session) await context.addInitScript((s) => { for (const [k, v] of Object.entries(s)) sessionStorage.setItem(k, v); }, session);
  const page = await context.newPage();
  await page.goto(`http://${host}:${server.port}/${path}`);
  return { context, page, cap };
}
const named = (cap, n) => cap.events.filter((e) => e.name === n);
const settle = (page) => page.waitForTimeout(700);

describe('GA4 事件 (out-real，主機名 priceeats.pages.dev)', () => {
  it('正式主機名：載入 gtag (async)，進站 ref 記下並帶在所有事件；search / found_meal(open_food、navigate) / share_click 參數正確', async () => {
    const { context, page, cap } = await openReal('?ref=fb-%E5%8D%97%E6%B8%AF');
    await page.getByTestId('search-button').waitFor();
    assert.equal(await page.locator('script[src*="googletagmanager.com/gtag/js?id=G-NNCJKE0X94"][async]').count(), 1);
    await page.getByTestId('search-button').click();
    await page.getByTestId('food-card').first().waitFor();
    await settle(page);
    await page.getByTestId('food-card').first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('link', { name: /導航過去/ }).evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
    await page.getByRole('link', { name: /導航過去/ }).click();
    await page.getByRole('dialog').getByTestId('share-button').click();
    await settle(page);
    await page.getByRole('button', { name: '回結果' }).click();
    await page.getByTestId('share-results').click();
    await settle(page);

    const search = named(cap, 'search');
    assert.equal(search.length, 1, '按搜尋只算一次');
    assert.deepEqual(search[0].params, { ref: 'fb-南港', budget: 100, area: '南港車站', cat: '不限', dist: 500, results: 6 });
    const meals = named(cap, 'found_meal');
    assert.deepEqual(meals.map((e) => e.params), [
      { ref: 'fb-南港', budget: 100, area: '南港車站', method: 'open_food' },
      { ref: 'fb-南港', budget: 100, area: '南港車站', method: 'navigate' },
    ]);
    assert.deepEqual(named(cap, 'share_click').map((e) => e.params), [
      { ref: 'fb-南港', location: 'food' },
      { ref: 'fb-南港', location: 'results' },
    ]);
    const pv = named(cap, 'page_view').map((e) => e.params.page_path);
    assert.deepEqual(pv.slice(0, 2), ['/?view=home', '/?view=results']);
    const dump = JSON.stringify(cap.events);
    assert.ok(!/lat|lng|25\.05|121\.60|0000000001|測試店|餐點\d/.test(dump), `事件不得含座標、餐點 id、店名：${dump}`);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('pe_ref')), 'fb-南港');
    console.log('攔截到的事件：\n' + cap.events.map((e) => `  ${e.name} ${JSON.stringify(e.params)}`).join('\n'));
    await context.close();
  });

  it('條件變更後結果出現再送一次 search；沒有 ref 送 none；area 在 8 區外為 other', async () => {
    const { context, page, cap } = await openReal('?view=results&budget=80');
    await page.getByTestId('result-summary').waitFor();
    await settle(page);
    await page.getByTestId('open-filter').click();
    await page.getByRole('button', { name: '距離 1km' }).click();
    await page.getByTestId('drawer-apply').click();
    await settle(page);
    const s = named(cap, 'search');
    assert.deepEqual(s.map((e) => [e.params.ref, e.params.budget, e.params.dist]), [['none', 80, 500], ['none', 80, 1000]]);
    await context.close();

    const far = await openReal('?view=results&lat=25.0143&lng=121.4627');
    await far.page.getByTestId('result-summary').waitFor();
    await settle(far.page);
    assert.equal(named(far.cap, 'search')[0].params.area, 'other');
    await far.context.close();
  });

  it('找到一餐只算有搜尋條件時：首頁尚未搜尋時不送 found_meal', async () => {
    const { context, page, cap } = await openReal('');
    await page.getByTestId('search-button').waitFor();
    await settle(page);
    assert.equal(named(cap, 'found_meal').length, 0);
    await context.close();
  });

  it('預覽網域 (主機名不符) 與 localhost 一律不載入、不送任何 Google 請求', async () => {
    for (const host of ['localhost', '127.0.0.1']) {
      const { context, page, cap } = await openReal('?view=results', { host });
      await page.getByTestId('result-summary').waitFor();
      await settle(page);
      assert.equal(await page.locator('script[src*="googletagmanager"]').count(), 0, host);
      assert.deepEqual(cap.googleRequests, [], host);
      assert.deepEqual(cap.events, [], host);
      await context.close();
    }
  });

  it('說明頁與入口頁 (全站) 也載入並送 page_view，page_path 為路徑', async () => {
    for (const p of ['about/privacy', 'area/nangang/100']) {
      const { context, page, cap } = await openReal(p);
      await page.locator('h1').waitFor();
      await settle(page);
      assert.equal(await page.locator('script[src*="googletagmanager"]').count(), 1, p);
      assert.deepEqual(named(cap, 'page_view').map((e) => e.params.page_path), [`/${p}`], p);
      await context.close();
    }
  });
});
