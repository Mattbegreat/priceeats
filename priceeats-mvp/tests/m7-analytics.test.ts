import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Privacy from '@/app/about/privacy/page';
import { CENTER_PRESETS } from '@/data/centers';
import {
  AREA_OTHER,
  REF_KEY,
  analyticsEnabled,
  areaName,
  createTracker,
  normalizeRef,
  viewPagePath,
  type AnalyticsConfig,
  type TrackerEnv,
} from '@/lib/analytics';
import { GA_ID, SITE_URL } from '@/lib/site';

const CFG: AnalyticsConfig = { gaId: 'G-TEST123', real: true, siteUrl: 'https://priceeats.pages.dev' };
const NANGANG = CENTER_PRESETS.find((c) => c.name === '南港車站')!;
const BANQIAO = { lat: 25.0143, lng: 121.4627 };

function fakeEnv(opts: { hostname?: string; search?: string; session?: Record<string, string> | 'throws' | null } = {}) {
  const store: Record<string, string> = opts.session && opts.session !== 'throws' ? opts.session : {};
  const scripts: string[] = [];
  const dataLayer: unknown[] = [];
  const env: TrackerEnv = {
    location: { hostname: opts.hostname ?? 'priceeats.pages.dev', search: opts.search ?? '', origin: 'https://priceeats.pages.dev', pathname: '/' },
    session:
      opts.session === null
        ? null
        : {
            getItem: (k) => {
              if (opts.session === 'throws') throw new Error('denied');
              return store[k] ?? null;
            },
            setItem: (k, v) => {
              if (opts.session === 'throws') throw new Error('denied');
              store[k] = v;
            },
          },
    dataLayer,
    injectScript: (s) => scripts.push(s),
  };
  /** dataLayer 內 gtag('event', …) 的 [name, params] */
  const events = () =>
    dataLayer
      .map((a) => Array.from(a as ArrayLike<unknown>))
      .filter((a) => a[0] === 'event')
      .map((a) => ({ name: a[1] as string, params: a[2] as Record<string, string | number> }));
  return { env, store, scripts, dataLayer, events };
}

describe('M7 設定', () => {
  it('GA_ID 預設為評估 ID；SITE_URL 預設 priceeats.pages.dev', () => {
    expect(GA_ID).toBe('G-NNCJKE0X94');
    expect(new URL(SITE_URL).hostname).toBe('priceeats.pages.dev');
  });
});

describe('M7 停用條件', () => {
  it('三種停用：主機名不符、非正式資料模式、空 ID；全符合才啟用', () => {
    expect(analyticsEnabled(CFG, 'priceeats.pages.dev')).toBe(true);
    expect(analyticsEnabled(CFG, 'localhost')).toBe(false);
    expect(analyticsEnabled(CFG, '127.0.0.1')).toBe(false);
    expect(analyticsEnabled(CFG, 'abc123.priceeats.pages.dev')).toBe(false); // 預覽網域
    expect(analyticsEnabled({ ...CFG, real: false }, 'priceeats.pages.dev')).toBe(false);
    expect(analyticsEnabled({ ...CFG, gaId: '' }, 'priceeats.pages.dev')).toBe(false);
    expect(analyticsEnabled({ ...CFG, gaId: '  ' }, 'priceeats.pages.dev')).toBe(false);
    expect(analyticsEnabled({ ...CFG, siteUrl: 'not a url' }, 'priceeats.pages.dev')).toBe(false);
  });
  it('停用時 track 全部是 no-op：不插入 script、dataLayer 不動', () => {
    for (const [cfg, host] of [
      [CFG, 'localhost'],
      [{ ...CFG, real: false }, 'priceeats.pages.dev'],
      [{ ...CFG, gaId: '' }, 'priceeats.pages.dev'],
    ] as const) {
      const f = fakeEnv({ hostname: host });
      const t = createTracker(cfg, f.env);
      expect(t.enabled).toBe(false);
      t.init();
      t.pageView('/?view=home');
      t.search({ budget: 100, cat: '不限', dist: 500, ...NANGANG }, 3);
      t.foundMeal({ budget: 100, ...NANGANG }, 'navigate');
      t.share('food');
      t.report(NANGANG);
      t.track('x');
      expect(f.scripts).toEqual([]);
      expect(f.dataLayer).toEqual([]);
    }
  });
  it('沒有瀏覽器環境 (伺服器端) 也是 no-op', () => {
    const t = createTracker(CFG, null);
    expect(() => t.search({ budget: 1, cat: '不限', dist: 500, ...NANGANG }, 0)).not.toThrow();
    expect(t.ref()).toBe('none');
  });
});

describe('M7 載入', () => {
  it('啟用時只插入一支 async gtag.js，config 不自動送 page_view 且 page_location 不含查詢參數', () => {
    const f = fakeEnv({ search: '?view=results&lat=25.05&lng=121.6&food=abc' });
    const t = createTracker(CFG, f.env);
    t.init();
    t.init();
    expect(f.scripts).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST123']);
    const cfg = Array.from(f.dataLayer[1] as ArrayLike<unknown>);
    expect(cfg[0]).toBe('config');
    expect(cfg[2]).toEqual({ send_page_view: false, page_location: 'https://priceeats.pages.dev/' });
  });
  it('page_view：page_path 含 view，不含 lat、lng、food id', () => {
    const f = fakeEnv({ search: '?view=results&lat=25.05&lng=121.6&food=abc' });
    const t = createTracker(CFG, f.env);
    t.pageView(viewPagePath('results'));
    const ev = f.events()[0]!;
    expect(ev.name).toBe('page_view');
    expect(ev.params.page_path).toBe('/?view=results');
    expect(JSON.stringify(f.dataLayer.map((a) => Array.from(a as ArrayLike<unknown>)))).not.toMatch(/lat=|lng=|food=|25\.05|121\.6|abc/);
  });
});

describe('M7 ref', () => {
  it('normalizeRef：保留原字串 (含中文)、截到 40 字、空白視為沒有', () => {
    expect(normalizeRef('fb-南港')).toBe('fb-南港');
    expect(normalizeRef('a'.repeat(60))).toBe('a'.repeat(40));
    expect(Array.from(normalizeRef('南'.repeat(50))!)).toHaveLength(40);
    expect(normalizeRef('')).toBeNull();
    expect(normalizeRef('   ')).toBeNull();
    expect(normalizeRef(null)).toBeNull();
  });
  it('第一次看到的 ref 存 sessionStorage，之後網址沒有 ref 也帶同一個值', () => {
    const f = fakeEnv({ search: '?ref=fb-%E5%8D%97%E6%B8%AF' });
    const t = createTracker(CFG, f.env);
    t.init();
    expect(f.store[REF_KEY]).toBe('fb-南港');
    f.env.location.search = '?view=results'; // App 改寫網址後 ref 消失
    const t2 = createTracker(CFG, f.env); // 同工作階段重新載入頁面
    expect(t2.ref()).toBe('fb-南港');
    t2.share('results');
    expect(f.events().at(-1)!.params.ref).toBe('fb-南港');
  });
  it('工作階段已有 ref 時，之後網址的 ref 不覆蓋', () => {
    const f = fakeEnv({ search: '?ref=share', session: { [REF_KEY]: 'fb-南港' } });
    expect(createTracker(CFG, f.env).ref()).toBe('fb-南港');
  });
  it('沒有 ref 送 none；sessionStorage 不可用 (丟錯或 null) 時仍可用記憶體', () => {
    expect(createTracker(CFG, fakeEnv().env).ref()).toBe('none');
    for (const session of ['throws', null] as const) {
      const f = fakeEnv({ search: '?ref=ig', session });
      const t = createTracker(CFG, f.env);
      expect(t.ref()).toBe('ig');
      f.env.location.search = '';
      expect(t.ref()).toBe('ig');
    }
  });
  it('超長 ref 截到 40 字再存', () => {
    const f = fakeEnv({ search: `?ref=${'x'.repeat(100)}` });
    createTracker(CFG, f.env).init();
    expect(f.store[REF_KEY]).toHaveLength(40);
  });
});

describe('M7 area', () => {
  it('8 區中心本身對應各自名稱', () => {
    for (const n of ['南港車站', '內湖科技園區', '市政府站', '松山車站', '汐止車站', '東湖站', '忠孝復興站', '民生社區']) {
      const c = CENTER_PRESETS.find((p) => p.name === n)!;
      expect(areaName(c)).toBe(n);
    }
  });
  it('離任何一區 > 3 公里 → other；自訂位置 3 公里內取最近一區', () => {
    expect(areaName(BANQIAO)).toBe(AREA_OTHER);
    expect(areaName({ lat: NANGANG.lat + 0.002, lng: NANGANG.lng + 0.002 })).toBe('南港車站');
  });
});

describe('M7 事件參數', () => {
  const P = { budget: 120, cat: '麵食' as const, dist: 1000, lat: NANGANG.lat, lng: NANGANG.lng };
  const setup = () => {
    const f = fakeEnv({ search: '?ref=fb-南港' });
    return { f, t: createTracker(CFG, f.env) };
  };
  it('search：ref、budget(數字)、area、cat、dist、results', () => {
    const { f, t } = setup();
    t.search(P, 7);
    expect(f.events()[0]).toEqual({
      name: 'search',
      params: { ref: 'fb-南港', budget: 120, area: '南港車站', cat: '麵食', dist: 1000, results: 7 },
    });
  });
  it('found_meal：open_food 與 navigate 各一，帶 ref、budget、area、method', () => {
    const { f, t } = setup();
    t.foundMeal(P, 'open_food');
    t.foundMeal(P, 'navigate');
    expect(f.events().map((e) => e.params)).toEqual([
      { ref: 'fb-南港', budget: 120, area: '南港車站', method: 'open_food' },
      { ref: 'fb-南港', budget: 120, area: '南港車站', method: 'navigate' },
    ]);
  });
  it('share_click：ref、location；report_submit：ref、area', () => {
    const { f, t } = setup();
    t.share('results');
    t.share('food');
    t.report(BANQIAO);
    expect(f.events().map((e) => [e.name, e.params])).toEqual([
      ['share_click', { ref: 'fb-南港', location: 'results' }],
      ['share_click', { ref: 'fb-南港', location: 'food' }],
      ['report_submit', { ref: 'fb-南港', area: 'other' }],
    ]);
  });
  it('任何事件都不含 lat、lng、food id、店名類欄位，也不含座標數值', () => {
    const { f, t } = setup();
    t.search(P, 1);
    t.foundMeal(P, 'open_food');
    t.share('food');
    t.report(P);
    const ALLOWED = new Set(['ref', 'budget', 'area', 'cat', 'dist', 'results', 'method', 'location']);
    for (const e of f.events()) for (const k of Object.keys(e.params)) expect(ALLOWED.has(k)).toBe(true);
    const json = JSON.stringify(f.events());
    expect(json).not.toContain(String(NANGANG.lat));
    expect(json).not.toContain(String(NANGANG.lng));
  });
});

describe('M7 隱私頁', () => {
  const out = renderToStaticMarkup(createElement(Privacy));
  it('新增使用統計段：GA4、收集項目、不收精確座標與個人身分、Google cookie；第三方清單含 Google Analytics', () => {
    for (const t of ['使用統計', 'Google Analytics 4', '瀏覽的頁面', '預算', '區域名稱', '點開餐點或按導航', '是否按分享', '來源參數', '不收集精確座標', '個人身分', 'cookie', '使用統計來自 Google Analytics'])
      expect(out).toContain(t);
  });
  it('沒有與追蹤矛盾的句子', () => {
    expect(out).not.toMatch(/不追蹤|不使用 cookie|不會追蹤|沒有任何追蹤/);
  });
});
