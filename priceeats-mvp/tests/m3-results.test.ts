import { describe, expect, it } from 'vitest';
import { buildSeed, seedToDataset } from '@/data/seed';
import { buildIndex, compareBy, search } from '@/lib/search/filter';
import { GROUP_PREVIEW, groupByStore } from '@/lib/search/group';
import { isMultiServing } from '@/lib/search/multi-serving';
import { DEFAULT_PARAMS, buildQuery, parseQuery } from '@/lib/search/params';
import type { FoodBase } from '@/lib/search/filter';
import type { FoodView, SearchParams } from '@/types';

const TODAY = new Date('2026-11-16T00:00:00.000Z');
const index = buildIndex(seedToDataset(buildSeed(), TODAY), TODAY, false);
const base: SearchParams = { ...DEFAULT_PARAMS, dist: 5000 };

const view = (id: string, rid: string, name: string, price: number, distanceM: number): FoodView =>
  ({
    food: { id, name, price },
    restaurant: { id: rid, name: rid },
    distanceM,
    rating: null,
  }) as unknown as FoodView;

describe('M3-3 排序「最貼近預算」', () => {
  it('預設排序是最貼近預算', () => {
    expect(DEFAULT_PARAMS.sort).toBe('budget');
  });
  it('價格高到低，同價距離近者優先；價格最低與距離最近仍保留', () => {
    const rows = [view('a', 'r1', 'A', 80, 300), view('b', 'r2', 'B', 100, 900), view('c', 'r3', 'C', 100, 200), view('d', 'r4', 'D', 60, 50)];
    expect(rows.slice().sort(compareBy('budget')).map((v) => v.food.id)).toEqual(['c', 'b', 'a', 'd']);
    expect(rows.slice().sort(compareBy('price')).map((v) => v.food.id)).toEqual(['d', 'a', 'c', 'b']);
    expect(rows.slice().sort(compareBy('distance')).map((v) => v.food.id)).toEqual(['d', 'c', 'a', 'b']);
  });
  it('搜尋結果價格皆不超過預算，且依價格由高到低', () => {
    const r = search(index, { ...base, budget: 120 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((v) => v.food.price <= 120)).toBe(true);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].food.price).toBeGreaterThanOrEqual(r[i].food.price);
  });
  it('舊網址 sort=price / distance / rating 仍可解析', () => {
    for (const s of ['price', 'distance', 'rating'] as const) expect(parseQuery(`?sort=${s}`, false).params.sort).toBe(s);
  });
});

describe('M3-1 以店分組', () => {
  const rows = [
    view('1', 'A', '甲1', 90, 100),
    view('2', 'B', '乙1', 85, 200),
    view('3', 'A', '甲2', 99, 100),
    view('4', 'A', '甲3', 40, 100),
    view('5', 'A', '甲4', 95, 100),
    view('6', 'C', '丙1', 70, 300),
  ];
  it('每家店一組；店的順序沿用原排序中第一次出現的位置', () => {
    expect(groupByStore(rows).map((g) => g.restaurantId)).toEqual(['A', 'B', 'C']);
  });
  it('店內依最貼近預算排列 (價格高到低)，全部餐點都在組內', () => {
    const a = groupByStore(rows)[0];
    expect(a.items.map((v) => v.food.id)).toEqual(['3', '5', '1', '4']);
    expect(a.items.slice(0, GROUP_PREVIEW).map((v) => v.food.price)).toEqual([99, 95, 90]);
  });
  it('分組不丟失、不重複餐點', () => {
    const g = groupByStore(rows);
    expect(g.reduce((n, x) => n + x.items.length, 0)).toBe(rows.length);
  });
  it('距離排序下前 30 筆結果分組後，店家數 = 不重複店家數', () => {
    const r = search(index, { ...base, budget: 300, sort: 'distance' });
    const groups = groupByStore(r);
    expect(groups.length).toBe(new Set(r.map((v) => v.restaurant.id)).size);
  });
});

describe('M3-4 多人份標記', () => {
  const mk = (name: string, price: number) => ({ food: { name, price } }) as unknown as FoodBase;
  it('名稱含人份、全家、桶、2 人以上套餐，或價格 >= 500', () => {
    for (const [n, p] of [
      ['炸雞桶', 300],
      ['雙人份牛排', 400],
      ['全家福拼盤', 450],
      ['超值套餐（2 人以上）', 450],
      ['3人套餐', 600],
      ['牛排', 500],
      ['鐵板燒', 799],
    ] as const) {
      expect(isMultiServing(mk(n, p)), n).toBe(true);
    }
  });
  it('一般餐點與 499 元以下不算多人份', () => {
    for (const [n, p] of [
      ['雞腿便當', 100],
      ['牛肉麵', 180],
      ['桶仔雞飯', 120],
      ['海鮮燴飯', 499],
    ] as const) {
      expect(isMultiServing(mk(n, p)), n).toBe(false);
    }
  });
  it('預設排除多人份，勾選 multi 才顯示', () => {
    const wide = { ...base, budget: 2000 };
    const hidden = search(index, { ...wide, multi: false });
    const shown = search(index, { ...wide, multi: true });
    expect(hidden.some((v) => isMultiServing(v))).toBe(false);
    expect(shown.length).toBeGreaterThanOrEqual(hidden.length);
    expect(shown.filter((v) => isMultiServing(v)).length).toBe(shown.length - hidden.length);
  });
  it('multi 參數可由網址還原，預設不寫入網址', () => {
    expect(parseQuery('?multi=1', false).params.multi).toBe(true);
    expect(parseQuery('', false).params.multi).toBe(false);
    expect(buildQuery({ view: 'results', params: { ...DEFAULT_PARAMS, multi: true }, food: null })).toContain('multi=1');
    expect(buildQuery({ view: 'results', params: DEFAULT_PARAMS, food: null })).not.toContain('multi');
  });
});
