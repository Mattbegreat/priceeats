import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryId } from '@/data/categories';
import { MIN_CONFIDENCE, emptyStats, formatReport, parseMapsCoords, validateStore, type ValidStore } from '@/lib/import/menu';
import { MenuImportWriter } from '@/lib/import/writer';

const fixture = JSON.parse(readFileSync(resolve(__dirname, 'fixtures/sample-store.json'), 'utf8'));

const base = (over: Record<string, unknown> = {}, items: unknown[] = [{ name: '排骨便當', price: 95, category: '便當', confidence: 0.9 }]) => ({
  restaurant: { name: '測試店', address: '台北市某路 1 號', lat: 25.04, lng: 121.51 },
  source_date: '2026-10-30',
  source_image: 'menu.jpg',
  items,
  ...over,
});

describe('座標解析 parseMapsCoords', () => {
  it('格式 1：@lat,lng（視窗中心）', () => {
    expect(parseMapsCoords('https://www.google.com/maps/place/Foo/@25.0478,121.5170,17z/data=!3m1!4b1')).toEqual({ lat: 25.0478, lng: 121.517 });
  });
  it('格式 2：?q=lat,lng', () => {
    expect(parseMapsCoords('https://maps.google.com/?q=25.0330,121.5654')).toEqual({ lat: 25.033, lng: 121.5654 });
  });
  it('格式 3：地點頁 !3d{lat}!4d{lng}，同時有 @ 時以精確的標記座標為準', () => {
    const url = 'https://www.google.com/maps/place/Foo/@25.1000,121.6000,17z/data=!4m6!3m5!1s0x3442:0xabc!8m2!3d25.0478!4d121.5170';
    expect(parseMapsCoords(url)).toEqual({ lat: 25.0478, lng: 121.517 });
  });
  it('格式 4：api=1&query=lat%2Clng（逗號被編碼）', () => {
    expect(parseMapsCoords('https://www.google.com/maps/search/?api=1&query=25.0478%2C121.5170')).toEqual({ lat: 25.0478, lng: 121.517 });
  });
  it('無法解析 → null：短網址、純店名搜尋、空值、超出範圍', () => {
    expect(parseMapsCoords('https://maps.app.goo.gl/AbCdEf123')).toBeNull();
    expect(parseMapsCoords('https://www.google.com/maps/search/?api=1&query=%E6%8E%92%E9%AA%A8%E4%BE%BF%E7%95%B6')).toBeNull();
    expect(parseMapsCoords('')).toBeNull();
    expect(parseMapsCoords(undefined)).toBeNull();
    expect(parseMapsCoords('https://www.google.com/maps/@125.0,121.5,17z')).toBeNull();
  });
});

describe('匯入驗證 validateStore', () => {
  it('樣本檔：3 道可寫入，4 道被跳過且各有原因；座標取自 google_maps_url', () => {
    const r = validateStore(fixture, 'sample-store.json');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.store.items.map((i) => i.name)).toEqual(['排骨便當', '滷肉飯', '陽春麵']);
    expect(r.store.items[0]!.tags).toEqual(['肉類']);
    expect(r.store.lat).toBe(25.0478);
    expect(r.store.lng).toBe(121.517);
    const reasons = Object.fromEntries(r.store.skippedItems.map((s) => [s.item, s.reason]));
    expect(Object.keys(reasons)).toHaveLength(4);
    expect(reasons['模糊的小菜']).toMatch(/信心 0\.62 < 0\.8/);
    expect(reasons['價格異常的便當']).toMatch(/價格需為 1–5000/);
    expect(reasons['價格有小數的湯']).toMatch(/價格需為 1–5000/);
    expect(reasons['不存在分類的甜點']).toMatch(/不在分類表/);
  });

  it('JSON 內的 lat/lng 優先於網址；只給一個也視為缺少，改由網址解析', () => {
    const both = validateStore(base({ restaurant: { name: 'A', address: 'B', lat: 24.1, lng: 120.6, google_maps_url: 'https://x.test/@25.0,121.0,17z' } }), 'f');
    expect(both.ok && both.store.lat).toBe(24.1);
    const half = validateStore(base({ restaurant: { name: 'A', address: 'B', lat: 24.1, google_maps_url: 'https://x.test/@25.0,121.0,17z' } }), 'f');
    expect(half.ok && [half.store.lat, half.store.lng]).toEqual([25, 121]);
  });

  it('缺座標且網址無法解析 → 整店跳過並說明原因', () => {
    const r = validateStore(base({ restaurant: { name: '無座標店', address: 'B', google_maps_url: 'https://maps.app.goo.gl/xyz' } }), 'f.json');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.skipped).toMatchObject({ file: 'f.json', name: '無座標店' });
    expect(r.skipped.reason).toMatch(/缺座標/);
    const none = validateStore(base({ restaurant: { name: '無座標店', address: 'B' } }), 'f.json');
    expect(none.ok).toBe(false);
  });

  it('信心門檻：0.8 寫入、0.79 跳過', () => {
    expect(MIN_CONFIDENCE).toBe(0.8);
    const r = validateStore(
      base({}, [
        { name: '剛好', price: 50, category: '小吃', confidence: 0.8 },
        { name: '差一點', price: 50, category: '小吃', confidence: 0.79 },
      ]),
      'f',
    );
    expect(r.ok && r.store.items.map((i) => i.name)).toEqual(['剛好']);
    expect(r.ok && r.store.skippedItems[0]!.reason).toMatch(/0\.79 < 0\.8/);
  });

  it('非法價格：0、負數、5001、小數、字串都跳過；1 與 5000 可寫入', () => {
    const items = [0, -5, 5001, 35.5, '50'].map((price, i) => ({ name: `壞${i}`, price, category: '便當', confidence: 0.9 }));
    items.push({ name: '最低', price: 1, category: '便當', confidence: 0.9 }, { name: '最高', price: 5000, category: '便當', confidence: 0.9 });
    const r = validateStore(base({}, items), 'f');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.store.items.map((i) => i.price)).toEqual([1, 5000]);
    expect(r.store.skippedItems).toHaveLength(5);
  });

  it('分類與 tags 必須在分類表；缺 confidence 視為格式錯誤', () => {
    const r = validateStore(
      base({}, [
        { name: '壞分類', price: 50, category: '甜點', confidence: 0.9 },
        { name: '壞標籤', price: 50, category: '便當', tags: ['火鍋'], confidence: 0.9 },
        { name: '沒信心', price: 50, category: '便當' },
        { name: '好', price: 50, category: '便當', confidence: 0.9 },
      ]),
      'f',
    );
    expect(r.ok && r.store.items.map((i) => i.name)).toEqual(['好']);
    expect(r.ok && r.store.skippedItems.map((s) => s.item)).toEqual(['壞分類', '壞標籤', '沒信心']);
  });

  it('同名品項只留最後一筆，前一筆列入報告；全部品項都被跳過則整店跳過', () => {
    const dup = validateStore(
      base({}, [
        { name: '便當', price: 80, category: '便當', confidence: 0.9 },
        { name: '便當', price: 90, category: '便當', confidence: 0.9 },
      ]),
      'f',
    );
    expect(dup.ok && dup.store.items).toHaveLength(1);
    expect(dup.ok && dup.store.items[0]!.price).toBe(90);
    expect(dup.ok && dup.store.skippedItems[0]!.reason).toMatch(/重複/);
    const none = validateStore(base({}, [{ name: '低信心', price: 50, category: '便當', confidence: 0.1 }]), 'f');
    expect(none.ok).toBe(false);
    expect(!none.ok && none.skipped.reason).toMatch(/沒有可寫入的品項/);
  });

  it('檔案層級錯誤：非物件、日期不合法、店名空白', () => {
    expect(validateStore(null, 'f').ok).toBe(false);
    expect(validateStore(base({ source_date: '2026-02-30' }), 'f').ok).toBe(false);
    expect(validateStore(base({ source_date: '2026/10/30' }), 'f').ok).toBe(false);
    expect(validateStore(base({ restaurant: { name: ' ', address: 'x', lat: 1, lng: 1 } }), 'f').ok).toBe(false);
  });
});

describe('報告 formatReport', () => {
  const store = (): ValidStore => {
    const r = validateStore(fixture, 'sample-store.json');
    if (!r.ok) throw new Error('fixture invalid');
    return r.store;
  };

  it('dry-run：可寫入筆數與跳過清單由資料算出', () => {
    const text = formatReport({ dryRun: true, fileCount: 2, stores: [store()], skippedStores: [{ file: 'b.json', name: 'B 店', reason: '缺座標：x' }], failedStores: [] });
    expect(text).toContain('dry-run');
    expect(text).toContain('檔案：2 個');
    expect(text).toContain('可寫入：店家 1 家、餐點 3 道');
    expect(text).toContain('跳過店家：1');
    expect(text).toContain('b.json ／ B 店：缺座標：x');
    expect(text).toContain('跳過品項：4');
  });

  it('實際寫入：新增店數、新增／更新餐點、價格紀錄', () => {
    const stats = { ...emptyStats(), newRestaurants: 1, newFoods: 2, updatedFoods: 1, newVerifications: 2, duplicateVerifications: 1 };
    const text = formatReport({ dryRun: false, fileCount: 1, stores: [store()], skippedStores: [], failedStores: [], stats });
    expect(text).toContain('新增店數：1');
    expect(text).toContain('餐點：新增 2、更新 1');
    expect(text).toContain('價格紀錄：新增 2（相同日期與價格已存在而略過 1）');
  });
});

describe('寫入器 MenuImportWriter（假的 PostgREST）', () => {
  const KEY = 'service-role-secret-123';
  interface Call {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  }

  function fakeDb(opts: { existingRestaurant?: boolean; failOn?: string } = {}) {
    const calls: Call[] = [];
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, headers: init?.headers as Record<string, string>, body });
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
      const table = new URL(url).pathname.split('/').pop()!;
      if (opts.failOn === table) return new Response('permission denied', { status: 401 });
      if (method === 'GET' && table === 'restaurants') return json(opts.existingRestaurant ? [{ id: 'r1' }] : []);
      if (method === 'POST' && table === 'restaurants') return json([{ id: 'r1' }], 201);
      if (method === 'GET' && table === 'foods') return json([{ id: 'f-old', name: '排骨便當' }]);
      if (method === 'POST' && table === 'foods')
        return json((body as { name: string }[]).map((f, i) => ({ id: f.name === '排骨便當' ? 'f-old' : `f-new${i}`, name: f.name })), 201);
      if (method === 'GET' && table === 'price_verifications')
        return json([{ food_id: 'f-old', reported_price: 95, verified_at: '2026-10-30T00:00:00+00:00' }]);
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    return { calls, writer: new MenuImportWriter('https://x.supabase.co/', KEY, fetchImpl) };
  }

  const loadStore = (): ValidStore => {
    const r = validateStore(fixture, 'sample-store.json');
    if (!r.ok) throw new Error('fixture invalid');
    return r.store;
  };

  it('upsert 鍵、is_test_data=false、menu_photo 驗證；筆數由寫入前的查詢算出', async () => {
    const { calls, writer } = fakeDb();
    const stats = await writer.writeStore(loadStore());
    expect(stats).toEqual({ newRestaurants: 1, newFoods: 2, updatedFoods: 1, newVerifications: 2, duplicateVerifications: 1 });

    const rPost = calls.find((c) => c.method === 'POST' && c.url.includes('/restaurants?'))!;
    expect(rPost.url).toContain('on_conflict=name,address');
    expect(rPost.headers.Prefer).toContain('resolution=merge-duplicates');
    expect((rPost.body as Record<string, unknown>[])[0]).toMatchObject({ is_test_data: false, source: 'menu_photo', latitude: 25.0478, longitude: 121.517 });

    const fPost = calls.find((c) => c.method === 'POST' && c.url.includes('/foods?'))!;
    expect(fPost.url).toContain('on_conflict=restaurant_id,name');
    expect((fPost.body as { name: string; category_id: string }[]).find((f) => f.name === '滷肉飯')!.category_id).toBe(categoryId('飯類'));

    const tagPost = calls.find((c) => c.url.includes('/food_tags?'))!;
    expect(tagPost.body).toEqual([{ food_id: 'f-old', category_id: categoryId('肉類') }]);

    const vPost = calls.find((c) => c.method === 'POST' && c.url.endsWith('/price_verifications'))!;
    const rows = vPost.body as Record<string, unknown>[];
    expect(rows).toHaveLength(2); // 排骨便當（同日同價）已存在 → 略過
    expect(rows.every((v) => v.source_type === 'menu_photo' && v.verification_status === 'menu_photo' && v.verified_at === '2026-10-30')).toBe(true);
    expect(rows.map((v) => v.reported_price).sort()).toEqual([40, 50]);
  });

  it('既有店不重複計為新增', async () => {
    const { writer } = fakeDb({ existingRestaurant: true });
    expect((await writer.writeStore(loadStore())).newRestaurants).toBe(0);
  });

  it('金鑰只出現在標頭，不在網址或內容；失敗訊息也不含金鑰', async () => {
    const { calls, writer } = fakeDb();
    await writer.writeStore(loadStore());
    for (const c of calls) {
      expect(c.headers.apikey).toBe(KEY);
      expect(c.headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(c.url).not.toContain(KEY);
      expect(JSON.stringify(c.body ?? '')).not.toContain(KEY);
    }
    const failing = fakeDb({ failOn: 'foods' });
    const err = await failing.writer.writeStore(loadStore()).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/foods 失敗 \(401\)/);
    expect((err as Error).message).not.toContain(KEY);
  });
});
