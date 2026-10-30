import { describe, expect, it } from 'vitest';
import { daysBetween, freshnessFromDays, freshnessOf } from '@/lib/pricing/freshness';
import { latestVerification } from '@/lib/pricing/verification';
import { REPORT_TYPES, validateReport } from '@/lib/pricing/report';
import { budgetSchema, buildQuery, parseBudgetInput, parseQuery, DEFAULT_PARAMS } from '@/lib/search/params';
import type { PriceVerification } from '@/types';

const TODAY = new Date('2026-10-30T00:00:00.000Z');
const ago = (d: number) => new Date(TODAY.getTime() - d * 86_400_000).toISOString();

describe('10. 新鮮度分級邊界', () => {
  it('30 天＝近期、31 天＝可能需要確認、90 天＝可能需要確認、91 天＝舊資料', () => {
    expect(freshnessOf(ago(0), TODAY)).toBe('recent');
    expect(freshnessOf(ago(30), TODAY)).toBe('recent');
    expect(freshnessOf(ago(31), TODAY)).toBe('maybe');
    expect(freshnessOf(ago(90), TODAY)).toBe('maybe');
    expect(freshnessOf(ago(91), TODAY)).toBe('old');
  });
  it('天數計算與純數字分級', () => {
    expect(daysBetween(ago(45), TODAY)).toBe(45);
    expect([30, 31, 90, 91].map(freshnessFromDays)).toEqual(['recent', 'maybe', 'maybe', 'old']);
  });
  it('未來日期視為 0 天', () => {
    expect(daysBetween(new Date(TODAY.getTime() + 5 * 86_400_000), TODAY)).toBe(0);
  });
});

describe('驗證狀態：最新一筆非 pending', () => {
  const mk = (id: string, days: number, status: PriceVerification['verification_status']): PriceVerification => ({
    id, food_id: 'f', reported_price: 100, report_type: null, note: null, source_type: 'store',
    source_image_url: null, verification_status: status, verified_at: ago(days), confidence_score: 0.9, created_at: ago(days),
  });
  it('略過較新的 pending', () => {
    const v = latestVerification([mk('old', 50, 'menu_photo'), mk('new-pending', 1, 'pending'), mk('mid', 20, 'store_confirmed')]);
    expect(v?.id).toBe('mid');
  });
  it('全部 pending 或空陣列 → null', () => {
    expect(latestVerification([mk('p', 1, 'pending')])).toBeNull();
    expect(latestVerification([])).toBeNull();
  });
});

describe('11. 預算輸入驗證', () => {
  it('0、-1、2001、非整數被拒', () => {
    for (const bad of ['0', '-1', '2001', '10.5', '', 'abc', ' ']) {
      expect(parseBudgetInput(bad).ok, `輸入 "${bad}"`).toBe(false);
    }
    expect(budgetSchema.safeParse(0).success).toBe(false);
    expect(budgetSchema.safeParse(-1).success).toBe(false);
    expect(budgetSchema.safeParse(2001).success).toBe(false);
    expect(budgetSchema.safeParse(10.5).success).toBe(false);
  });
  it('1、100、2000 通過', () => {
    for (const ok of ['1', '100', '2000', ' 150 ']) expect(parseBudgetInput(ok).ok).toBe(true);
  });
});

describe('價格回報驗證', () => {
  const base = { food_id: 'f', report_type: 'price_up' as const, reported_price: 120, note: null };
  it('調漲需高於現價、調降需低於現價', () => {
    expect(validateReport(base, 100)).toBeNull();
    expect(validateReport({ ...base, reported_price: 90 }, 100)).toMatch(/高於/);
    expect(validateReport({ ...base, report_type: 'price_down', reported_price: 90 }, 100)).toBeNull();
    expect(validateReport({ ...base, report_type: 'price_down', reported_price: 110 }, 100)).toMatch(/低於/);
  });
  it('停售不需價格；資訊錯誤需說明；價格範圍 1–5000', () => {
    expect(validateReport({ ...base, report_type: 'discontinued', reported_price: null }, 100)).toBeNull();
    expect(validateReport({ ...base, report_type: 'info_error', reported_price: null }, 100)).toMatch(/說明/);
    expect(validateReport({ ...base, report_type: 'info_error', reported_price: null, note: '菜名寫錯' }, 100)).toBeNull();
    expect(validateReport({ ...base, reported_price: 5001 }, 100)).not.toBeNull();
    expect(REPORT_TYPES).toHaveLength(4);
  });
});

describe('URL query 還原狀態', () => {
  it('預設值不寫入網址；往返一致', () => {
    expect(buildQuery({ view: 'home', params: DEFAULT_PARAMS, food: null })).toBe('');
    const s = { view: 'results' as const, params: { ...DEFAULT_PARAMS, budget: 150, cat: '肉類' as const, dist: 2000, sort: 'rating' as const, minRating: 4 }, food: 'abc' };
    const back = parseQuery(buildQuery(s));
    expect(back).toEqual(s);
  });
  it('非法參數退回預設', () => {
    const s = parseQuery('?view=zzz&budget=-5&cat=火星料理&dist=abc&sort=x&lat=999');
    expect(s.view).toBe('home');
    expect(s.params).toEqual(DEFAULT_PARAMS);
  });
});
