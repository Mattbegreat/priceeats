import { AREAS, AREA_BUDGETS, AREA_DIST_M, type AreaBudget, type AreaInfo } from '@/data/areas';
import { walkMinutes } from './geo/walk';
import type { AreaEntry } from './area-listing';
import { ABOUT_PAGES, SITE_URL } from './site';

/** 預先產生的店數與餐點數 (scripts/gen-area-stats.mjs 寫入 src/data/area-stats.json) */
export interface AreaStats {
  /** 統計日期 YYYY-MM-DD；沒有資料時為 null */
  generatedAt: string | null;
  distM?: number;
  areas: Record<string, Record<string, AreaEntry | undefined> | undefined>;
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
export function lookupStat(stats: AreaStats, slug: string, budget: number): AreaEntry | null {
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

/** 台北時間今天 YYYY-MM-DD (sitemap 的建置日期) */
export function taipeiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** sitemap 的 lastmod (YYYY-MM-DD)：入口頁用統計日期 (沒有就用建置日期)，首頁與說明頁用建置日期 */
export function lastmodFor(path: string, generatedAt: string | null, buildDate: string): string {
  const isArea = path.startsWith('/area/');
  return isArea && generatedAt && /^\d{4}-\d{2}-\d{2}$/.test(generatedAt) ? generatedAt : buildDate;
}

/** 該頁的說明段落：模板＋JSON 內的數字，不寫死；缺的欄位整句略過。沒有店數與餐點數時回 null。 */
export function areaSummary(centerName: string, budget: number, entry: AreaEntry | null, dateLabel: string | null): string | null {
  if (!entry) return null;
  const parts: string[] = [];
  parts.push(`以${centerName}為中心走路約 ${walkMinutes(AREA_DIST_M)} 分鐘內，${budget} 元以內有 ${entry.dishes} 道餐點、${entry.stores} 家店。`);
  if (entry.topCategories && entry.topCategories.length) parts.push(`最常見的是${entry.topCategories.join('、')}。`);
  if (entry.cheapest) {
    const { min, max } = entry.cheapest;
    parts.push(`最便宜的主餐從 ${min} 元起。`);
  }
  parts.push(`${dateLabel ? `資料統計至 ${dateLabel}，` : ''}價格來自店家菜單照片的 AI 辨識，請以店內實際價格為準。`);
  return parts.join('');
}

/** JSON-LD (schema.org ItemList)：只有店名與頁內網址 (#store-N)，不含評分、營業時間等沒有的資料 */
export function areaItemListJsonLd(title: string, path: string, entry: AreaEntry | null): Record<string, unknown> | null {
  const list = entry?.list;
  if (!list || list.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: list.length,
    itemListElement: list.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, url: `${absoluteUrl(path)}#store-${i + 1}` })),
  };
}
