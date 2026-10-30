import { describe, expect, it } from 'vitest';
import { buildSeed, seedToDataset } from '@/data/seed';
import { DEFAULT_CENTER } from '@/data/centers';
import { haversineM } from '@/lib/geo/haversine';
import { buildIndex, compareBy, search } from '@/lib/search/filter';
import { DEFAULT_PARAMS } from '@/lib/search/params';
import { relaxSuggestions } from '@/lib/search/relax';
import type { FoodView, SearchParams } from '@/types';

// 固定日期 + 固定種子資料
const TODAY = new Date('2026-10-30T00:00:00.000Z');
const data = seedToDataset(buildSeed(), TODAY);
const index = buildIndex(data, TODAY);
const base: SearchParams = { ...DEFAULT_PARAMS, dist: 5000 };
const run = (p: Partial<SearchParams>) => search(index, { ...base, ...p });

describe('模擬資料規格', () => {
  it('30 家以上餐廳、150 筆以上餐點、每家 3–8 道', () => {
    expect(data.restaurants.length).toBeGreaterThanOrEqual(30);
    expect(data.foods.length).toBeGreaterThanOrEqual(150);
    for (const r of data.restaurants) {
      const n = data.foods.filter((f) => f.restaurant_id === r.id).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(8);
    }
  });
  it('每次載入結果相同 (固定種子)', () => {
    const a = JSON.stringify(seedToDataset(buildSeed(), TODAY));
    const b = JSON.stringify(seedToDataset(buildSeed(), TODAY));
    expect(a).toBe(b);
  });
  it('新鮮度涵蓋三種分級，且店家皆標示測試資料', () => {
    const set = new Set(index.map((i) => i.freshness));
    expect(set.has('recent') && set.has('maybe') && set.has('old')).toBe(true);
    expect(data.restaurants.every((r) => r.is_test_data && r.name.includes('（測試）'))).toBe(true);
  });
  it('價格合理：滷肉飯 35–60、雞腿便當 95–140、牛肉麵 150–280', () => {
    const range = (name: string) => data.foods.filter((f) => f.name === name).map((f) => f.price);
    for (const p of range('滷肉飯')) expect(p).toBeGreaterThanOrEqual(35), expect(p).toBeLessThanOrEqual(65);
    for (const p of range('雞腿便當')) expect(p).toBeGreaterThanOrEqual(90), expect(p).toBeLessThanOrEqual(150);
    for (const p of range('牛肉麵')) expect(p).toBeGreaterThanOrEqual(150), expect(p).toBeLessThanOrEqual(285);
  });
  it('首頁預設值 (100 元／不限／1 公里／價格最低) 直接有結果', () => {
    expect(search(index, DEFAULT_PARAMS).length).toBeGreaterThan(0);
  });
});

describe('1. 預算是硬上限', () => {
  it('預算 100 → 所有結果 price <= 100，且 100 元整的餐點會出現', () => {
    const r = run({ budget: 100 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((v) => v.food.price <= 100)).toBe(true);
    const exact = r.filter((v) => v.food.price === 100);
    expect(exact.length).toBeGreaterThan(0);
    // 資料集中範圍內所有 100 元餐點都在結果中
    const expected = index.filter(
      (b) => b.food.price === 100 && haversineM(DEFAULT_CENTER, { lat: b.restaurant.latitude, lng: b.restaurant.longitude }) <= 5000,
    );
    expect(exact.length).toBe(expected.length);
  });
});

describe('2. 預算放寬結果變多', () => {
  it('預算 150 的結果數 > 預算 100', () => {
    expect(run({ budget: 150 }).length).toBeGreaterThan(run({ budget: 100 }).length);
  });
});

describe('3–4. 分類篩選', () => {
  it('便當 → 結果主分類全為便當', () => {
    const r = run({ budget: 500, cat: '便當' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((v) => v.categoryName === '便當')).toBe(true);
  });
  it('肉類 → 主分類或標籤含肉類，且包含「主分類不是肉類、靠標籤命中」的餐點', () => {
    const r = run({ budget: 500, cat: '肉類' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((v) => v.categoryName === '肉類' || v.tagNames.includes('肉類'))).toBe(true);
    expect(r.some((v) => v.categoryName === '便當' && v.tagNames.includes('肉類'))).toBe(true);
  });
  it('雞腿便當＝主分類便當、標籤肉類', () => {
    const chicken = index.find((b) => b.food.name === '雞腿便當');
    expect(chicken?.categoryName).toBe('便當');
    expect(chicken?.tagNames).toContain('肉類');
  });
});

describe('5–7. 排序 (含次排序)', () => {
  const r = (v: FoodView) => v.rating ?? -1;
  it('價格最低：價格→距離→評分(高到低)', () => {
    const out = run({ budget: 300, sort: 'price' });
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      if (a.food.price === b.food.price) {
        expect(a.distanceM).toBeLessThanOrEqual(b.distanceM);
        if (a.distanceM === b.distanceM) expect(r(a)).toBeGreaterThanOrEqual(r(b));
      } else expect(a.food.price).toBeLessThan(b.food.price);
    }
  });
  it('距離最近：距離→價格', () => {
    const out = run({ budget: 300, sort: 'distance' });
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      expect(a.distanceM).toBeLessThanOrEqual(b.distanceM);
      if (a.distanceM === b.distanceM) expect(a.food.price).toBeLessThanOrEqual(b.food.price);
    }
  });
  it('評價最高：評分(高到低)→價格', () => {
    const out = run({ budget: 300, sort: 'rating' });
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      expect(r(a)).toBeGreaterThanOrEqual(r(b));
      if (r(a) === r(b)) expect(a.food.price).toBeLessThanOrEqual(b.food.price);
    }
  });
  it('次排序 (固定資料，明確同值情境)', () => {
    const mk = (id: string, price: number, distanceM: number, rating: number): FoodView =>
      ({ food: { id, price }, distanceM, rating }) as unknown as FoodView;
    const rows = [mk('a', 80, 500, 4.0), mk('b', 80, 300, 4.0), mk('c', 80, 300, 4.8), mk('d', 60, 900, 3.5)];
    expect(rows.slice().sort(compareBy('price')).map((x) => x.food.id)).toEqual(['d', 'c', 'b', 'a']);
    const rows2 = [mk('a', 90, 300, 4.0), mk('b', 70, 300, 4.0), mk('c', 70, 100, 4.0)];
    expect(rows2.slice().sort(compareBy('distance')).map((x) => x.food.id)).toEqual(['c', 'b', 'a']);
    const rows3 = [mk('a', 90, 100, 4.5), mk('b', 70, 900, 4.5), mk('c', 10, 900, 3.0)];
    expect(rows3.slice().sort(compareBy('rating')).map((x) => x.food.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('8. 半徑與其他篩選', () => {
  it('半徑 2km >= 1km，5km >= 2km，且 500m <= 1km', () => {
    const c = (dist: number) => run({ budget: 500, dist }).length;
    expect(c(500)).toBeLessThanOrEqual(c(1000));
    expect(c(2000)).toBeGreaterThanOrEqual(c(1000));
    expect(c(5000)).toBeGreaterThanOrEqual(c(2000));
    expect(c(5000)).toBeGreaterThan(c(1000));
  });
  it('半徑邊界含等號', () => {
    const one = run({ budget: 500, dist: 5000 })[0]!;
    const exact = search(index, { ...base, budget: 500, dist: one.distanceM });
    expect(exact.some((v) => v.food.id === one.food.id)).toBe(true);
  });
  it('最低評分只留下評分達標的店', () => {
    const out = run({ budget: 500, minRating: 4.5 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((v) => (v.rating ?? 0) >= 4.5)).toBe(true);
  });
  it('停售餐點不出現', () => {
    const copy = index.map((b, i) => (i === 0 ? { ...b, food: { ...b.food, is_available: false } } : b));
    const out = search(copy, { ...base, budget: 5000 });
    expect(out.some((v) => v.food.id === index[0]!.food.id)).toBe(false);
  });
  it('桃園車站為中心時只看到桃園的店', () => {
    const out = search(index, { ...base, lat: 24.9894, lng: 121.3138, dist: 2000, budget: 500 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((v) => v.restaurant.address.includes('桃園'))).toBe(true);
  });
});

describe('Empty State 放寬建議', () => {
  it('預算 30、500m、評分 4.5 沒結果；建議的筆數與實際套用後一致且至少一項有結果', () => {
    const p = { ...DEFAULT_PARAMS, budget: 30, dist: 500, minRating: 4.5 };
    expect(search(index, p)).toHaveLength(0);
    const s = relaxSuggestions(index, p);
    expect(s.map((x) => x.label)).toEqual(['預算 +50', '距離擴大一級']);
    for (const x of s) expect(search(index, x.params)).toHaveLength(x.count);
    expect(s.some((x) => x.count > 0)).toBe(true);
    expect(s[0]!.params.budget).toBe(80);
    expect(s[1]!.params.dist).toBe(1000);
  });
});

describe('9. Haversine', () => {
  it('台北車站→西門距離約 1.0–1.4 km', () => {
    const d = haversineM({ lat: 25.0478, lng: 121.517 }, { lat: 25.0421, lng: 121.5081 });
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1400);
  });
  it('同點為 0，且對稱', () => {
    const a = { lat: 25.0478, lng: 121.517 };
    const b = { lat: 24.9894, lng: 121.3138 };
    expect(haversineM(a, a)).toBe(0);
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });
});
