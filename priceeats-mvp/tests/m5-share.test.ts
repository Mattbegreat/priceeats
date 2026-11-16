import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/EmptyState';
import { distOptionText } from '@/components/Chips';
import { CENTER_PRESETS } from '@/data/centers';
import { haversineM } from '@/lib/geo/haversine';
import { COVERAGE_RADIUS_M, nearestArea, outsideCoverage } from '@/lib/geo/nearest';
import { WALK_LABEL_MAX_M, walkMinutes, walkOrKm } from '@/lib/geo/walk';
import { foodShareText, buildShareUrl, resultsShareText } from '@/lib/share';
import { DEFAULT_PARAMS, DIST_OPTIONS, buildQuery, parseQuery } from '@/lib/search/params';

const EAST8_NAMES = ['南港車站', '內湖科技園區', '市政府站', '松山車站', '汐止車站', '東湖站', '忠孝復興站', '民生社區'];
const EAST8 = CENTER_PRESETS.filter((c) => EAST8_NAMES.includes(c.name));
const BANQIAO = { lat: 25.0143, lng: 121.4627 };

describe('M5 小修：預設距離 500m', () => {
  it('DEFAULT_PARAMS.dist = 500；網址已帶 dist 的不受影響', () => {
    expect(DEFAULT_PARAMS.dist).toBe(500);
    expect(parseQuery('').params.dist).toBe(500);
    expect(parseQuery('?dist=1000').params.dist).toBe(1000);
    expect(parseQuery('?dist=5000').params.dist).toBe(5000);
  });
  it('預設值不寫入網址；dist=1000 現在要寫入', () => {
    expect(buildQuery({ view: 'results', params: DEFAULT_PARAMS, food: null })).toBe('?view=results');
    expect(buildQuery({ view: 'results', params: { ...DEFAULT_PARAMS, dist: 1000 }, food: null })).toContain('dist=1000');
  });
});

describe('M5 小修：步行時間', () => {
  it('walkMinutes = max(1, round(m / 70))', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(34)).toBe(1);
    expect(walkMinutes(35)).toBe(1); // 0.5 四捨五入為 1
    expect(walkMinutes(105)).toBe(2); // 1.5 → 2
    expect(walkMinutes(500)).toBe(7);
    expect(walkMinutes(1000)).toBe(14);
    expect(walkMinutes(1500)).toBe(21);
  });
  it('≤ 1500m 顯示「走路約 N 分」，超過顯示公里', () => {
    expect(walkOrKm(500)).toBe('走路約 7 分');
    expect(walkOrKm(WALK_LABEL_MAX_M)).toBe('走路約 21 分');
    expect(walkOrKm(1501)).toBe('1.5km');
    expect(walkOrKm(2300)).toBe('2.3km');
    expect(walkOrKm(5000)).toBe('5.0km');
  });
  it('抽屜「走多遠」選項文字用 walkMinutes 算', () => {
    expect(DIST_OPTIONS.map(distOptionText)).toEqual(['走路 7 分（500m）', '走路 14 分（1km）', '2km', '5km']);
  });
});

describe('M5-3 最近區域', () => {
  it('板橋 (25.0143, 121.4627) 離東區 8 區都超過 3 公里，最近是忠孝復興站', () => {
    const o = outsideCoverage(BANQIAO, EAST8);
    expect(o).not.toBeNull();
    expect(o!.area.name).toBe('忠孝復興站');
    expect(o!.distanceM).toBeGreaterThan(COVERAGE_RADIUS_M);
    expect(o!.distanceM).toBeCloseTo(haversineM(BANQIAO, o!.area), 6);
  });
  it('nearestArea：選距離最小者；空清單回 null', () => {
    expect(nearestArea({ lat: 25.0527, lng: 121.6 }, EAST8)!.area.name).toBe('南港車站');
    expect(nearestArea(BANQIAO, [])).toBeNull();
  });
  it('8 區任一中心 3 公里內不算範圍外 (南港車站、東區)', () => {
    expect(outsideCoverage({ lat: 25.0525, lng: 121.6073 }, EAST8)).toBeNull();
    expect(outsideCoverage({ lat: 25.0416, lng: 121.5437 }, EAST8)).toBeNull();
  });
  it('邊界：剛好 3 公里不引導、超過才引導', () => {
    const a = [{ name: 'A', lat: 25, lng: 121 }];
    const d = haversineM({ lat: 25.027, lng: 121 }, a[0]!);
    expect(outsideCoverage({ lat: 25.027, lng: 121 }, a, d)).toBeNull();
    expect(outsideCoverage({ lat: 25.027, lng: 121 }, a, d - 1)).not.toBeNull();
  });
  it('EmptyState 正式模式：板橋顯示「目前只有台北東區 8 區」＋最近一區＋上傳菜單；南港不顯示', () => {
    const noop = () => {};
    const base = { index: [], onParams: noop, onPickArea: noop, onUpload: noop, real: true, areas: EAST8 };
    const far = renderToStaticMarkup(createElement(EmptyState, { ...base, params: { ...DEFAULT_PARAMS, ...BANQIAO } }));
    expect(far).toContain('目前只有台北東區 8 區');
    expect(far).toContain('忠孝復興站');
    expect(far).toContain('上傳菜單');
    const near = renderToStaticMarkup(createElement(EmptyState, { ...base, params: DEFAULT_PARAMS }));
    expect(near).not.toContain('目前只有台北東區');
    const mock = renderToStaticMarkup(createElement(EmptyState, { ...base, real: false, params: { ...DEFAULT_PARAMS, ...BANQIAO } }));
    expect(mock).not.toContain('目前只有台北東區');
  });
});

describe('M5-1 分享連結與文字', () => {
  it('保留目前網址條件並加 ref=share；已有 ref 覆蓋', () => {
    const u = new URL(buildShareUrl('https://priceeats.pages.dev/?view=results&budget=120&cat=%E4%BE%BF%E7%95%B6&dist=1000'));
    expect(u.searchParams.get('ref')).toBe('share');
    expect(u.searchParams.get('budget')).toBe('120');
    expect(u.searchParams.get('cat')).toBe('便當');
    expect(u.searchParams.get('dist')).toBe('1000');
    expect(u.searchParams.get('view')).toBe('results');
    expect(buildShareUrl('https://x.test/?ref=abc&budget=50')).toBe('https://x.test/?ref=share&budget=50');
    expect(buildShareUrl('https://x.test/')).toBe('https://x.test/?ref=share');
  });
  it('分享文字', () => {
    expect(resultsShareText('南港車站', 100, 23)).toBe('南港車站 100 元內有 23 道，看看今天吃什麼');
    expect(foodShareText('阿財滷肉飯', '滷肉飯', 45)).toBe('阿財滷肉飯 滷肉飯 45 元');
  });
  it('ref 只讀取、不影響搜尋條件，且會保留在網址', () => {
    const a = parseQuery('?view=results&budget=80');
    const b = parseQuery('?view=results&budget=80&ref=share');
    expect(b.params).toEqual(a.params);
    expect(b.ref).toBe('share');
    expect(buildQuery(b)).toContain('ref=share');
    expect(buildQuery(a)).not.toContain('ref');
  });
});
