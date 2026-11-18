import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import AreaPage from '@/app/area/[slug]/[budget]/page';
import sitemap from '@/app/sitemap';
import stats from '@/data/area-stats.json';
import { AREAS, AREA_BUDGETS, AREA_DIST_M, findArea } from '@/data/areas';
import { buildSeed, seedToDataset } from '@/data/seed';
import { areaItemListJsonLd, areaSummary, lastmodFor, lookupStat, statDateLabel, taipeiToday, type AreaStats } from '@/lib/area-pages';
import { LIST_ITEMS_PER_STORE, LIST_STORES, buildAreaEntry } from '@/lib/area-listing';
import { walkMinutes } from '@/lib/geo/walk';
import { buildIndex, search } from '@/lib/search/filter';
import { groupByStore } from '@/lib/search/group';
import { DEFAULT_PARAMS } from '@/lib/search/params';
import { metadata as layoutMeta } from '@/app/layout';
import { SITE_URL } from '@/lib/site';

const TODAY = new Date('2026-11-18T00:00:00Z');
const render = async (slug: string, budget: string) => renderToStaticMarkup((await AreaPage({ params: Promise.resolve({ slug, budget }) })) as ReactElement);
const st = stats as AreaStats;

describe('SEO 清單產生 (buildAreaEntry)', () => {
  const data = seedToDataset(buildSeed(), TODAY);
  const index = buildIndex(data, TODAY, false);
  const center = { lat: 25.0478, lng: 121.517 };
  const frontend = (budget: number) =>
    groupByStore(search(index, { ...DEFAULT_PARAMS, budget, cat: '不限', dist: AREA_DIST_M, sort: 'budget', sides: false, multi: false, minRating: 0, lat: center.lat, lng: center.lng }));

  it('前 10 家店、順序、每家 2 道，與前端 search＋groupByStore 完全一致', () => {
    const e = buildAreaEntry(index, center, 150);
    const g = frontend(150);
    expect(g.length).toBeGreaterThan(0);
    expect(e.stores).toBe(g.length);
    expect(e.list!.length).toBe(Math.min(LIST_STORES, g.length));
    e.list!.forEach((s, i) => {
      expect(s.id).toBe(g[i]!.restaurantId);
      expect(s.name).toBe(g[i]!.head.restaurant.name);
      expect(s.walkMinutes).toBe(walkMinutes(g[i]!.head.distanceM));
      expect(s.items.length).toBe(Math.min(LIST_ITEMS_PER_STORE, g[i]!.items.length));
      s.items.forEach((it, j) => {
        expect(it.name).toBe(g[i]!.items[j]!.food.name);
        expect(it.price).toBe(g[i]!.items[j]!.food.price);
        expect(it.price).toBeLessThanOrEqual(150);
      });
    });
  });
  it('餐點數、最便宜 3 道價格區間、最常見 3 個分類都由程式算出', () => {
    const e = buildAreaEntry(index, center, 150);
    const all = search(index, { ...DEFAULT_PARAMS, budget: 150, cat: '不限', dist: AREA_DIST_M, sort: 'price', sides: false, multi: false, minRating: 0, lat: center.lat, lng: center.lng });
    expect(e.dishes).toBe(all.length);
    const prices = all.map((v) => v.food.price).sort((a, b) => a - b);
    expect(e.cheapest).toEqual({ min: prices[0], max: prices[2] });
    expect(e.topCategories!.length).toBeLessThanOrEqual(3);
    const cnt = (n: string) => all.filter((v) => v.categoryName === n).length;
    const c = e.topCategories!.map(cnt);
    expect(c).toEqual([...c].sort((a, b) => b - a));
  });
  it('沒有符合的餐點：空清單、cheapest 為 null', () => {
    const e = buildAreaEntry(index, { lat: 0, lng: 0 }, 50);
    expect(e).toMatchObject({ stores: 0, dishes: 0, cheapest: null, topCategories: [], list: [] });
  });
});

describe('已提交的 area-stats.json', () => {
  it('24 組都有清單：≤10 家、每家 ≤2 道、價格 ≤ 預算、步行分鐘 ≥1、有店名與餐點名', () => {
    expect(statDateLabel(st.generatedAt)).not.toBeNull();
    for (const a of AREAS) for (const b of AREA_BUDGETS) {
      const e = lookupStat(st, a.slug, b)!;
      expect(e.list!.length, `${a.slug}/${b}`).toBe(Math.min(LIST_STORES, e.stores));
      expect(e.cheapest!.min).toBeLessThanOrEqual(e.cheapest!.max);
      expect(e.topCategories!.length).toBeGreaterThan(0);
      for (const s of e.list!) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.walkMinutes).toBeGreaterThanOrEqual(1);
        expect(s.items.length).toBeGreaterThanOrEqual(1);
        expect(s.items.length).toBeLessThanOrEqual(LIST_ITEMS_PER_STORE);
        for (const it of s.items) {
          expect(it.name.length).toBeGreaterThan(0);
          expect(it.price).toBeLessThanOrEqual(b);
        }
      }
    }
  });
});

describe('入口頁說明文字與清單', () => {
  it('說明文字的數字全部來自 JSON', async () => {
    const e = lookupStat(st, 'nangang', 100)!;
    const text = areaSummary('南港車站', 100, e, statDateLabel(st.generatedAt))!;
    expect(text).toContain(`${e.dishes} 道餐點、${e.stores} 家店`);
    expect(text).toContain(e.topCategories!.join('、'));
    expect(text).toContain(`從 ${e.cheapest!.min} 元起`);
    expect(text).toContain(`資料統計至 ${statDateLabel(st.generatedAt)}`);
    expect(text).toContain('走路約 7 分鐘內');
    const out = await render('nangang', '100');
    expect(out).toContain(text);
  });
  it('改 JSON 數字，文字跟著變 (沒有寫死)', () => {
    const t = areaSummary('X站', 50, { stores: 3, dishes: 12, cheapest: { min: 31, max: 35 }, topCategories: ['麵食'] }, '2030/01/02')!;
    expect(t).toBe('以X站為中心走路約 7 分鐘內，50 元以內有 12 道餐點、3 家店。最常見的是麵食。最便宜的主餐從 31 元起。資料統計至 2030/01/02，價格來自店家菜單照片的 AI 辨識，請以店內實際價格為準。');
    expect(areaSummary('X站', 50, null, null)).toBeNull();
    expect(areaSummary('X站', 50, { stores: 1, dishes: 1 }, null)).not.toContain('資料統計至');
  });
  it('原始 HTML 就有 10 家店名與對應價格，連結帶 lat、lng、budget；24 頁都有清單', async () => {
    for (const a of AREAS) for (const b of AREA_BUDGETS) {
      const e = lookupStat(st, a.slug, b)!;
      const out = await render(a.slug, String(b));
      expect((out.match(/data-testid="area-store"/g) ?? []).length).toBe(e.list!.length);
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
      for (const s of e.list!) {
        expect(out, `${a.slug}/${b} ${s.name}`).toContain(esc(s.name));
        for (const it of s.items) expect(out).toContain(`>${it.price}</span>`);
      }
      expect(out).toContain(`budget=${b}&amp;lat=`);
    }
    const area = findArea('nangang')!;
    const out = await render('nangang', '100');
    expect(out).toContain(`lat=${area.lat.toFixed(5)}`);
  });
  it('JSON-LD 可解析：ItemList、店名與網址，不含評分或營業時間', async () => {
    const out = await render('nangang', '100');
    const m = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    const j = JSON.parse(m![1]!.replace(/\\u003c/g, '<'));
    const e = lookupStat(st, 'nangang', 100)!;
    expect(j['@context']).toBe('https://schema.org');
    expect(j['@type']).toBe('ItemList');
    expect(j.numberOfItems).toBe(e.list!.length);
    expect(j.itemListElement).toHaveLength(e.list!.length);
    j.itemListElement.forEach((x: { '@type': string; position: number; name: string; url: string }, i: number) => {
      expect(x['@type']).toBe('ListItem');
      expect(x.position).toBe(i + 1);
      expect(x.name).toBe(e.list![i]!.name);
      expect(x.url).toBe(`${SITE_URL}/area/nangang/100#store-${i + 1}`);
    });
    expect(JSON.stringify(j)).not.toMatch(/rating|openingHours|aggregateRating|review/i);
    expect(areaItemListJsonLd('t', '/p', { stores: 0, dishes: 0, list: [] })).toBeNull();
    expect(areaItemListJsonLd('t', '/p', null)).toBeNull();
  });
  it('沒有清單時不輸出 JSON-LD (只有 stores／dishes 的舊格式)', () => {
    expect(areaItemListJsonLd('t', '/p', { stores: 3, dishes: 9 })).toBeNull();
  });
});

describe('sitemap lastmod', () => {
  it('28 個網址都有 YYYY-MM-DD 的 lastmod；入口頁＝統計日期，首頁與說明頁＝建置日期', () => {
    const items = sitemap();
    expect(items).toHaveLength(28);
    const build = taipeiToday();
    expect(build).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const it of items) {
      expect(String(it.lastModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(it.lastModified).toBe(it.url.includes('/area/') ? st.generatedAt : build);
    }
  });
  it('lastmodFor：入口頁沒有統計日期就退回建置日期；格式不對也退回', () => {
    expect(lastmodFor('/area/a/50', '2026-11-18', '2026-12-01')).toBe('2026-11-18');
    expect(lastmodFor('/area/a/50', null, '2026-12-01')).toBe('2026-12-01');
    expect(lastmodFor('/area/a/50', '11/18', '2026-12-01')).toBe('2026-12-01');
    expect(lastmodFor('/', '2026-11-18', '2026-12-01')).toBe('2026-12-01');
    expect(lastmodFor('/about/source', '2026-11-18', '2026-12-01')).toBe('2026-12-01');
  });
});

describe('Search Console 驗證', () => {
  it('layout metadata 帶 google-site-verification', () => {
    expect(layoutMeta.verification).toEqual({ google: 'AlBF-8ICckImbt6pAuA62T4qmFs8SKW14jCUa05HtQk' });
  });
});
