/** GA4 事件追蹤：所有事件統一由 track() 送出；未載入 (停用條件成立) 時全部是 no-op。
 *  隱私：不送經緯度、餐點 id、店名；page_location 也只含路徑與 view，不含查詢參數中的座標。 */
import { AREAS, findArea } from '@/data/areas';
import { IS_REAL_DATA } from '@/data/centers';
import { COVERAGE_RADIUS_M, nearestArea } from '@/lib/geo/nearest';
import { GA_ID, SITE_URL } from '@/lib/site';
import type { LatLng, SearchParams } from '@/types';

export const REF_KEY = 'pe_ref';
export const REF_MAX_LEN = 40;
export const REF_NONE = 'none';
export const AREA_OTHER = 'other';

/** 8 區的區域中心 (名稱與入口頁、地點選單一致) */
const AREA_CENTERS = AREAS.map((a) => findArea(a.slug)).filter((a): a is NonNullable<typeof a> => a !== null);

/** 搜尋中心對應的區域名稱：中心距某區中心 ≤ 3 公里取最近一區，否則 'other'。不回傳座標。 */
export function areaName(pos: LatLng): string {
  const n = nearestArea(pos, AREA_CENTERS);
  return n && n.distanceM <= COVERAGE_RADIUS_M ? n.area.name : AREA_OTHER;
}

/** 進站 ?ref= 的值：保留原字串 (可含中文)，截到 40 字；空白視為沒有 */
export function normalizeRef(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  return Array.from(raw).slice(0, REF_MAX_LEN).join('');
}

export interface AnalyticsConfig {
  gaId: string;
  real: boolean;
  siteUrl: string;
}

export function siteHostname(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return '';
  }
}

/** 載入條件：有 ID、正式資料模式、目前主機名等於 SITE_URL 的主機名。其餘 (localhost、測試、預覽網域) 一律不載入。 */
export function analyticsEnabled(cfg: AnalyticsConfig, hostname: string): boolean {
  const host = siteHostname(cfg.siteUrl);
  return cfg.gaId.trim() !== '' && cfg.real && host !== '' && hostname === host;
}

export type FoundMealMethod = 'open_food' | 'navigate';
export type ShareLocation = 'results' | 'food';
export type EventParams = Record<string, string | number>;

/** 執行環境 (注入以利測試) */
export interface TrackerEnv {
  location: { hostname: string; search: string; origin: string; pathname: string };
  /** sessionStorage；不可用時為 null。讀寫仍會 try/catch */
  session: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
  dataLayer: unknown[];
  injectScript(src: string): void;
}

export function createTracker(cfg: AnalyticsConfig, env: TrackerEnv | null) {
  const enabled = env !== null && analyticsEnabled(cfg, env.location.hostname);
  let started = false;
  let memRef: string | null = null;

  /** 第一次看到的 ref 存 sessionStorage，同一工作階段之後都帶同一個值；沒有就 'none' */
  function ref(): string {
    if (!env) return REF_NONE;
    if (memRef) return memRef;
    try {
      const saved = normalizeRef(env.session?.getItem(REF_KEY));
      if (saved) return (memRef = saved);
    } catch {
      /* 無痕模式等情況：只用記憶體 */
    }
    const fromUrl = normalizeRef(new URLSearchParams(env.location.search).get('ref'));
    if (fromUrl) {
      memRef = fromUrl;
      try {
        env.session?.setItem(REF_KEY, fromUrl);
      } catch {
        /* 忽略 */
      }
      return fromUrl;
    }
    return REF_NONE;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function gtag(..._args: unknown[]): void {
    // gtag.js 只認 arguments 物件，不認一般陣列
    // eslint-disable-next-line prefer-rest-params
    env?.dataLayer.push(arguments);
  }

  /** 載入 gtag.js (<script async> 動態插入)；可重複呼叫。page_view 由 pageView() 手動送，網址只留路徑。 */
  function init(): boolean {
    if (!enabled || !env) return false;
    if (started) return true;
    started = true;
    ref(); // 先把進站 ref 記下來 (之後 App 可能改寫網址)
    gtag('js', new Date());
    gtag('config', cfg.gaId, { send_page_view: false, page_location: env.location.origin + env.location.pathname });
    env.injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.gaId)}`);
    return true;
  }

  function track(name: string, params: EventParams = {}): void {
    if (!init()) return;
    gtag('event', name, { ref: ref(), ...params });
  }

  /** path 只含路徑與 view，不含 lat、lng、food id；同步更新之後所有事件的 page_location */
  function pageView(path: string): void {
    if (!init() || !env) return;
    gtag('set', { page_path: path, page_location: env.location.origin + path });
    gtag('event', 'page_view', { page_path: path, page_location: env.location.origin + path, ref: ref() });
  }

  return {
    enabled,
    init,
    ref,
    track,
    pageView,
    search: (p: Pick<SearchParams, 'budget' | 'cat' | 'dist' | 'lat' | 'lng'>, results: number) =>
      track('search', { budget: p.budget, area: areaName(p), cat: p.cat, dist: p.dist, results }),
    foundMeal: (p: Pick<SearchParams, 'budget' | 'lat' | 'lng'>, method: FoundMealMethod) =>
      track('found_meal', { budget: p.budget, area: areaName(p), method }),
    share: (location: ShareLocation) => track('share_click', { location }),
    report: (p: Pick<SearchParams, 'lat' | 'lng'>) => track('report_submit', { area: areaName(p) }),
  };
}

export type Tracker = ReturnType<typeof createTracker>;

/** 單頁 App 的 view 對應的 page_path (只含 view) */
export function viewPagePath(view: string): string {
  return `/?view=${encodeURIComponent(view)}`;
}

let singleton: Tracker | null = null;

/** 瀏覽器端單例；伺服器端 (預先產生頁面) 回傳停用的 tracker */
export function getTracker(): Tracker {
  if (singleton) return singleton;
  const cfg: AnalyticsConfig = { gaId: GA_ID, real: IS_REAL_DATA, siteUrl: SITE_URL };
  if (typeof window === 'undefined') return (singleton = createTracker(cfg, null));
  const w = window as unknown as { dataLayer?: unknown[] };
  let session: TrackerEnv['session'] = null;
  try {
    session = window.sessionStorage;
  } catch {
    session = null;
  }
  singleton = createTracker(cfg, {
    location: window.location,
    session,
    get dataLayer() {
      return (w.dataLayer ??= []);
    },
    injectScript(src) {
      const s = document.createElement('script');
      s.async = true;
      s.src = src;
      document.head.appendChild(s);
    },
  });
  return singleton;
}

export const track = (name: string, params?: EventParams) => getTracker().track(name, params);
export const trackPageView = (path: string) => getTracker().pageView(path);
export const trackSearch = (...a: Parameters<Tracker['search']>) => getTracker().search(...a);
export const trackFoundMeal = (...a: Parameters<Tracker['foundMeal']>) => getTracker().foundMeal(...a);
export const trackShare = (...a: Parameters<Tracker['share']>) => getTracker().share(...a);
export const trackReport = (...a: Parameters<Tracker['report']>) => getTracker().report(...a);
export const analyticsOn = () => getTracker().enabled;
