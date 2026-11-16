import { AREAS, AREA_BUDGETS, AREA_DIST_M, type AreaBudget, type AreaInfo } from '@/data/areas';
import { ABOUT_PAGES, SITE_URL } from './site';

/** 預先產生的店數與餐點數 (scripts/gen-area-stats.mjs 寫入 src/data/area-stats.json) */
export interface AreaStats {
  /** 統計日期 YYYY-MM-DD；沒有資料時為 null */
  generatedAt: string | null;
  distM?: number;
  areas: Record<string, Record<string, { stores: number; dishes: number } | undefined> | undefined>;
}

export function areaPath(slug: string, budget: number): string {
  return `/area/${slug}/${budget}`;
}

/** 「開始搜尋」連到帶 lat、lng、budget 的結果頁 */
export function searchHref(area: Pick<AreaInfo, 'lat' | 'lng'>, budget: number): string {
  const sp = new URLSearchParams({ view: 'results', budget: String(budget), lat: area.lat.toFixed(5), lng: area.lng.toFixed(5) });
  return `/?${sp.toString()}`;
}

/** 查不到就回 null (頁面不顯示數字) */
export function lookupStat(stats: AreaStats, slug: string, budget: number): { stores: number; dishes: number } | null {
  const s = stats.areas[slug]?.[String(budget)];
  return s && Number.isFinite(s.stores) && Number.isFinite(s.dishes) ? s : null;
}

/** 2026-11-16 → 2026/11/16；格式不對回 null */
export function statDateLabel(iso: string | null): string | null {
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.replaceAll('-', '/') : null;
}

export function areaTitle(center: string, budget: number): string {
  return `${center} ${budget} 元內吃什麼`;
}

export function areaDescription(center: string, budget: number): string {
  return `${center}走路約 ${Math.round(AREA_DIST_M / 70)} 分鐘內，${budget} 元以內買得起的餐點與店內價。價格來自店家菜單照片，每道標示更新年月。`;
}

/** sitemap 的全部路徑：首頁＋說明頁＋入口頁 */
export function allPaths(): string[] {
  return ['/', ...ABOUT_PAGES.map((p) => p.path), ...AREAS.flatMap((a) => AREA_BUDGETS.map((b: AreaBudget) => areaPath(a.slug, b)))];
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path === '/' ? '' : path}`;
}
