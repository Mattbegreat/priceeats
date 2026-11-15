import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshnessFromDays, formatUpdatedMonth, updatedLabel } from '@/lib/pricing/freshness';
import { distShort, withinWords } from '@/lib/geo/format';
import { sameStoreAlternatives } from '@/lib/search/same-store';
import type { FoodBase } from '@/lib/search/filter';
import { DEFAULT_PARAMS } from '@/lib/search/params';
import type { FoodView } from '@/types';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const f = (id: string, rid: string, name: string, price: number, over: Partial<FoodBase['food']> = {}): FoodBase =>
  ({
    food: { id, restaurant_id: rid, name, price, is_available: true, ...over },
    restaurant: { id: rid },
    categoryName: '便當',
    tagNames: [],
    verification: null,
    freshness: null,
    rating: null,
  }) as unknown as FoodBase;

const params = { ...DEFAULT_PARAMS, budget: 100, sides: true, multi: true };

describe('M4-8 新鮮度文案：只顯示更新年月', () => {
  it('更新年月 YYYY/MM (UTC)', () => {
    expect(formatUpdatedMonth('2026-03-15T00:00:00.000Z')).toBe('2026/03');
    expect(formatUpdatedMonth('2025-12-31T23:59:59.000Z')).toBe('2025/12');
  });
  it('6 個月內與 6–18 個月：只有「2026/03 更新」，不出現「近期」「可能需要確認」', () => {
    for (const fr of ['recent', 'maybe'] as const) {
      const t = updatedLabel('2026-03-15T00:00:00.000Z', fr);
      expect(t).toBe('2026/03 更新');
      expect(t).not.toMatch(/近期|可能需要確認|舊資料/);
    }
  });
  it('超過 18 個月才標「舊資料」(正式資料 549 天起)', () => {
    expect(freshnessFromDays(548, true)).toBe('maybe');
    expect(freshnessFromDays(549, true)).toBe('old');
    expect(updatedLabel('2025-01-10T00:00:00.000Z', 'old')).toBe('舊資料 · 2025/01 更新');
  });
  it('原始碼不再有「近期資料」「可能需要確認」字樣 (UI 與標籤)', () => {
    for (const p of ['src/lib/pricing/freshness.ts', 'src/lib/pricing/verification.ts', 'src/components/Badges.tsx', 'src/components/FoodDetailSheet.tsx']) {
      const src = read(p).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(src, p).not.toMatch(/近期資料|可能需要確認|近期菜單/);
    }
  });
});

describe('M4-9 餐點頁「這家店 N 元內還有」「多加一點預算」', () => {
  const cur = { food: f('cur', 'r1', '原味蛋餅', 30).food };
  const pool = [
    cur as unknown as FoodBase,
    ...['a', 'b', 'c', 'd', 'e', 'g', 'h'].map((k, i) => f(k, 'r1', `餐${k}`, 100 - i * 5)), // 100,95,90,85,80,75,70
    f('x1', 'r1', '加價一', 105),
    f('x2', 'r1', '加價二', 120),
    f('x3', 'r1', '加價三', 110),
    f('x4', 'r1', '加價四', 115),
    f('x5', 'r1', '太貴', 121),
    f('o1', 'r2', '別家店', 50),
    f('na', 'r1', '已下架', 60, { is_available: false }),
  ];

  it('預算內最多 5 道，價格高到低 (最貼近預算)，不含自己、別家店、下架', () => {
    const r = sameStoreAlternatives(pool, cur as unknown as FoodView, params);
    expect(r.within.map((b) => b.food.price)).toEqual([100, 95, 90, 85, 80]);
    expect(r.within.every((b) => b.food.restaurant_id === 'r1' && b.food.id !== 'cur' && b.food.is_available)).toBe(true);
  });
  it('超出預算但 <= 預算+20 最多 3 道，價格低到高；121 元不列', () => {
    const r = sameStoreAlternatives(pool, cur as unknown as FoodView, params);
    expect(r.extra.map((b) => b.food.price)).toEqual([105, 110, 115]);
    const all = sameStoreAlternatives(pool, cur as unknown as FoodView, { ...params, budget: 101 });
    expect(all.extra.every((b) => b.food.price <= 121)).toBe(true);
  });
  it('預算邊界：預算內含等於預算；預算+20 含邊界', () => {
    const r = sameStoreAlternatives(pool, cur as unknown as FoodView, { ...params, budget: 100 });
    expect(r.within[0]!.food.price).toBe(100);
    expect(sameStoreAlternatives([cur as unknown as FoodBase, f('e1', 'r1', 'E', 120)], cur as unknown as FoodView, params).extra).toHaveLength(1);
  });
  it('沒有同店其他餐點時兩區都是空的', () => {
    const r = sameStoreAlternatives([cur as unknown as FoodBase, f('o', 'r2', 'O', 50)], cur as unknown as FoodView, params);
    expect(r).toEqual({ within: [], extra: [] });
  });
});

describe('M4 收據風格 token', () => {
  it('色票寫成 CSS 變數與 Tailwind theme，命名同規格', () => {
    const css = read('src/app/globals.css');
    const want: Record<string, string> = {
      ground: '213 222 230',
      paper: '251 251 247',
      ink: '34 37 42',
      carbon: '43 76 155',
      stamp: '210 51 43',
      leader: '154 163 173',
      edge: '185 196 206',
    };
    for (const [k, v] of Object.entries(want)) expect(css).toContain(`--${k}: ${v};`);
    const tw = read('tailwind.config.ts');
    for (const k of Object.keys(want)) expect(tw).toMatch(new RegExp(`${k}: token\\('${k}'\\)`));
    expect(tw).not.toMatch(/#[0-9a-fA-F]{6}/); // theme 不散落 hex
    expect(tw).toContain('Noto Sans TC');
    expect(tw).toContain('IBM Plex Mono');
  });
  it('元件不再使用舊色票與餐點示意圖', () => {
    const files = ['App', 'HomeView', 'ResultsView', 'StoreCard', 'FoodDetailSheet', 'FoodCard', 'FavoritesView', 'MapView', 'UploadView', 'BottomNav'];
    for (const n of files) {
      const src = read(`src/components/${n}.tsx`);
      expect(src, n).not.toMatch(/forest|\blime\b|canvas|text-mute|border-line|rounded-card|FoodIllustration|FoodImage/);
    }
  });
  it('字型：layout 以 <link> 載入 Noto Sans TC 與 IBM Plex Mono，不新增 npm 套件', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toContain('family=Noto+Sans+TC:wght@400;500;700;900');
    expect(layout).toContain('family=IBM+Plex+Mono:wght@500;600');
    expect(layout).toContain('display=swap');
    const pkg = JSON.parse(read('package.json'));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['leaflet', 'lucide-react', 'next', 'react', 'react-dom', 'react-leaflet', 'zod']);
  });
});

describe('M4-6 加到主畫面 (manifest)', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  it('名稱、standalone、主題色、start_url', () => {
    expect(m.name).toContain('PriceEats');
    expect(m.short_name).toBe('PriceEats');
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toBe('#D5DEE6');
    expect(m.background_color).toBe('#D5DEE6');
    expect(m.start_url).toBe('./');
  });
  it('有 192／512 PNG 圖示與 maskable', () => {
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
    for (const f of ['public/icon-192.png', 'public/icon-512.png']) {
      const b = readFileSync(resolve(root, f));
      expect(b.subarray(1, 4).toString()).toBe('PNG');
      const w = b.readUInt32BE(16);
      expect(w).toBe(f.includes('192') ? 192 : 512);
    }
  });
  it('layout：theme color 與 apple-touch-icon', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toContain("themeColor: '#D5DEE6'");
    expect(layout).toContain('apple-touch-icon');
    expect(layout).toContain('appleWebApp');
  });
});

describe('距離顯示', () => {
  it('收據距離：390m、1.2km', () => {
    expect(distShort(394)).toBe('390m');
    expect(distShort(1234)).toBe('1.2km');
    expect(withinWords(500)).toBe('500 公尺內');
    expect(withinWords(2000)).toBe('2 公里內');
  });
});
