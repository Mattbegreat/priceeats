import { AREA_DIST_M } from '@/data/areas';
import { walkMinutes } from '@/lib/geo/walk';
import { updatedLabel } from '@/lib/pricing/freshness';
import { search, type FoodBase } from '@/lib/search/filter';
import { groupByStore } from '@/lib/search/group';
import { DEFAULT_PARAMS } from '@/lib/search/params';
import { CATEGORY_NAMES } from '@/types';

/** 入口頁清單：最多幾家店、每家最多幾道 */
export const LIST_STORES = 10;
export const LIST_ITEMS_PER_STORE = 2;
/** 「最便宜主餐」取幾道、「最常見分類」取幾個 */
export const CHEAPEST_COUNT = 3;
export const TOP_CATEGORY_COUNT = 3;

export interface AreaListItem {
  name: string;
  price: number;
  /** 更新年月，例 2026/03；超過 18 個月加「（舊資料）」；沒有驗證紀錄為 null */
  updated: string | null;
}

export interface AreaListStore {
  id: string;
  name: string;
  /** 步行分鐘 (直線距離 ÷ 70m，至少 1) */
  walkMinutes: number;
  items: AreaListItem[];
}

export interface AreaEntry {
  stores: number;
  dishes: number;
  /** 最便宜的 3 道主餐價格區間；沒有餐點為 null */
  cheapest?: { min: number; max: number } | null;
  /** 最常見的 3 個分類 (依餐點數，同數依固定分類順序) */
  topCategories?: string[];
  /** 前 10 家店、每家最多 2 道 */
  list?: AreaListStore[];
}

/**
 * 入口頁用的資料：套用與前端相同的預設 (500m、排除單點小菜與多人份、排序「最貼近預算」、以店分組)，
 * 直接呼叫 search／groupByStore，不重寫規則。純函式，日期由 index 內的 freshness 決定。
 */
export function buildAreaEntry(index: FoodBase[], center: { lat: number; lng: number }, budget: number, distM: number = AREA_DIST_M): AreaEntry {
  const results = search(index, {
    ...DEFAULT_PARAMS,
    budget,
    cat: '不限',
    dist: distM,
    sort: 'budget',
    sides: false,
    multi: false,
    minRating: 0,
    lat: center.lat,
    lng: center.lng,
  });
  const groups = groupByStore(results);
  const list: AreaListStore[] = groups.slice(0, LIST_STORES).map((g) => ({
    id: g.restaurantId,
    name: g.head.restaurant.name,
    walkMinutes: walkMinutes(g.head.distanceM),
    items: g.items.slice(0, LIST_ITEMS_PER_STORE).map((v) => ({
      name: v.food.name,
      price: v.food.price,
      updated: v.verification ? updatedLabel(v.verification.verified_at, v.freshness) : null,
    })),
  }));
  const cheapest = results
    .map((v) => v.food.price)
    .sort((a, b) => a - b)
    .slice(0, CHEAPEST_COUNT);
  const counts = new Map<string, number>();
  for (const v of results) counts.set(v.categoryName, (counts.get(v.categoryName) ?? 0) + 1);
  const order = (n: string) => (CATEGORY_NAMES as readonly string[]).indexOf(n);
  const topCategories = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]))
    .slice(0, TOP_CATEGORY_COUNT)
    .map(([n]) => n);
  return {
    stores: groups.length,
    dishes: results.length,
    cheapest: cheapest.length ? { min: cheapest[0]!, max: cheapest[cheapest.length - 1]! } : null,
    topCategories,
    list,
  };
}
