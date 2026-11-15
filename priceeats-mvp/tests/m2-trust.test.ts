import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilterBar } from '@/components/FilterBar';
import { noPhotoText } from '@/components/FoodDetailSheet';
import { freshnessFromDays, freshnessOf } from '@/lib/pricing/freshness';
import { DEFAULT_PARAMS, availableSorts, buildQuery, parseQuery } from '@/lib/search/params';
import { siteDescription } from '@/lib/site';
import type { PriceVerification } from '@/types';

const TODAY = new Date('2026-11-16T00:00:00.000Z');
const ago = (d: number) => new Date(TODAY.getTime() - d * 86_400_000).toISOString();

describe('M2-1 新鮮度分級 (正式模式 6／18 個月)', () => {
  it('正式：0–183 天近期、184–548 天可能需要確認、549 天起舊資料', () => {
    const f = (d: number) => freshnessFromDays(d, true);
    expect([0, 31, 91, 183].map(f)).toEqual(['recent', 'recent', 'recent', 'recent']);
    expect([184, 200, 365, 366, 548].map(f)).toEqual(['maybe', 'maybe', 'maybe', 'maybe', 'maybe']);
    expect([549, 600, 900].map(f)).toEqual(['old', 'old', 'old']);
  });
  it('測試資料模式維持 30／90 天', () => {
    const f = (d: number) => freshnessFromDays(d, false);
    expect([30, 31, 90, 91].map(f)).toEqual(['recent', 'maybe', 'maybe', 'old']);
  });
  it('同一筆 91 天前的價格：測試資料算舊、正式資料仍算近期', () => {
    expect(freshnessOf(ago(91), TODAY, false)).toBe('old');
    expect(freshnessOf(ago(91), TODAY, true)).toBe('recent');
    expect(freshnessOf(ago(300), TODAY, true)).toBe('maybe');
  });
});

describe('M2-2 正式模式隱藏評分篩選與評價排序', () => {
  it('URL 帶 minRating 或 sort=rating 時，正式模式忽略', () => {
    const s = parseQuery('?view=results&minRating=4.5&sort=rating', true);
    expect(s.params.minRating).toBe(0);
    expect(s.params.sort).toBe(DEFAULT_PARAMS.sort);
  });
  it('正式模式保留其他排序；測試資料模式照舊保留評分參數', () => {
    expect(parseQuery('?sort=distance', true).params.sort).toBe('distance');
    expect(parseQuery('?sort=price', true).params.sort).toBe('price');
    const t = parseQuery('?minRating=4&sort=rating', false);
    expect(t.params.minRating).toBe(4);
    expect(t.params.sort).toBe('rating');
  });
  it('排序選項：正式模式沒有「評價最高」', () => {
    expect(availableSorts(true)).not.toContain('rating');
    expect(availableSorts(false)).toContain('rating');
  });
  it('結果頁篩選列 DOM：正式模式無「最低評分」「評價最高」，測試模式有', () => {
    const noop = () => {};
    const real = renderToStaticMarkup(createElement(FilterBar, { params: DEFAULT_PARAMS, onParams: noop, real: true }));
    expect(real).not.toContain('最低評分');
    expect(real).not.toContain('評價最高');
    expect(real).toContain('最貼近預算');
    const test = renderToStaticMarkup(createElement(FilterBar, { params: DEFAULT_PARAMS, onParams: noop, real: false }));
    expect(test).toContain('最低評分');
    expect(test).toContain('評價最高');
  });
});

describe('M2-3 meta description', () => {
  it('正式模式不含「測試資料示範版」，且為指定文案', () => {
    expect(siteDescription(true)).toBe('輸入預算，找附近買得起的餐點與店內價。');
    expect(siteDescription(true)).not.toContain('測試資料示範版');
  });
  it('測試模式仍標示測試資料', () => {
    expect(siteDescription(false)).toContain('測試資料示範版');
  });
});

describe('M2-5 菜單照片空狀態文字', () => {
  const v = (source_type: PriceVerification['source_type'], verification_status: PriceVerification['verification_status']) =>
    ({ source_type, verification_status }) as PriceVerification;
  it('來源是菜單照片辨識 → 菜單照片未公開', () => {
    expect(noPhotoText(v('menu_photo', 'menu_photo'))).toBe('菜單照片未公開');
  });
  it('其他來源或沒有驗證紀錄 → 尚無菜單照片', () => {
    expect(noPhotoText(v('store', 'store_confirmed'))).toBe('尚無菜單照片');
    expect(noPhotoText(null)).toBe('尚無菜單照片');
  });
});

describe('URL 向後相容', () => {
  it('舊網址 sort=price 仍然有效，且預設排序（最貼近預算）不寫進網址', () => {
    expect(parseQuery('?sort=price', false).params.sort).toBe('price');
    expect(buildQuery({ view: 'results', params: DEFAULT_PARAMS, food: null })).toBe('?view=results');
    expect(buildQuery({ view: 'results', params: { ...DEFAULT_PARAMS, sort: 'price' }, food: null })).toContain('sort=price');
  });
});
