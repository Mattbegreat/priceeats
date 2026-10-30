import { haversineM } from '@/lib/geo/haversine';
import { freshnessOf } from '@/lib/pricing/freshness';
import { groupByFood, latestVerification } from '@/lib/pricing/verification';
import type { CategoryName, Dataset, FoodView, SearchParams } from '@/types';

/** 與搜尋中心無關的預先計算結果 (距離之外的欄位) */
export type FoodBase = Omit<FoodView, 'distanceM'>;

/** 把資料集攤平成可搜尋的清單；today 由呼叫端注入 */
export function buildIndex(data: Dataset, today: Date): FoodBase[] {
  const catName = new Map(data.categories.map((c) => [c.id, c.name as CategoryName]));
  const rest = new Map(data.restaurants.map((r) => [r.id, r]));
  const tags = new Map<string, CategoryName[]>();
  for (const t of data.foodTags) {
    const n = catName.get(t.category_id);
    if (!n) continue;
    const arr = tags.get(t.food_id);
    if (arr) arr.push(n);
    else tags.set(t.food_id, [n]);
  }
  const vers = groupByFood(data.verifications);
  const out: FoodBase[] = [];
  for (const food of data.foods) {
    const restaurant = rest.get(food.restaurant_id);
    const cn = catName.get(food.category_id);
    if (!restaurant || !cn) continue;
    const verification = latestVerification(vers.get(food.id) ?? []);
    out.push({
      food,
      restaurant,
      categoryName: cn,
      tagNames: tags.get(food.id) ?? [],
      verification,
      freshness: verification ? freshnessOf(verification.verified_at, today) : null,
      rating: restaurant.google_rating,
    });
  }
  return out;
}

const cmp = (a: number, b: number) => a - b;

/** 排序規則：價格→距離→評分；距離→價格；評分(高到低)→價格。最後以 id 保持穩定。 */
export function compareBy(sort: SearchParams['sort']): (a: FoodView, b: FoodView) => number {
  const r = (v: FoodView) => v.rating ?? -1;
  return (a, b) => {
    let c = 0;
    if (sort === 'price') {
      c = cmp(a.food.price, b.food.price) || cmp(a.distanceM, b.distanceM) || cmp(r(b), r(a));
    } else if (sort === 'distance') {
      c = cmp(a.distanceM, b.distanceM) || cmp(a.food.price, b.food.price);
    } else {
      c = cmp(r(b), r(a)) || cmp(a.food.price, b.food.price);
    }
    return c || a.food.id.localeCompare(b.food.id);
  };
}

/** 搜尋：預算為硬上限 (price <= budget)，半徑含邊界 (<= dist)。 */
export function search(index: FoodBase[], p: SearchParams): FoodView[] {
  const center = { lat: p.lat, lng: p.lng };
  const out: FoodView[] = [];
  for (const b of index) {
    if (!b.food.is_available) continue;
    if (b.food.price > p.budget) continue;
    if (p.cat !== '不限' && b.categoryName !== p.cat && !b.tagNames.includes(p.cat)) continue;
    if (p.minRating > 0 && (b.rating === null || b.rating < p.minRating)) continue;
    const distanceM = haversineM(center, { lat: b.restaurant.latitude, lng: b.restaurant.longitude });
    if (distanceM > p.dist) continue;
    out.push({ ...b, distanceM });
  }
  return out.sort(compareBy(p.sort));
}

/** 某間店在條件下的最低價 (地圖標記用) */
export function groupByRestaurant(results: FoodView[]): Map<string, FoodView[]> {
  const m = new Map<string, FoodView[]>();
  for (const v of results) {
    const arr = m.get(v.restaurant.id);
    if (arr) arr.push(v);
    else m.set(v.restaurant.id, [v]);
  }
  return m;
}

/** 單一餐點在指定中心下的完整檢視 (詳情面板用) */
export function toView(base: FoodBase, center: { lat: number; lng: number }): FoodView {
  return {
    ...base,
    distanceM: haversineM(center, { lat: base.restaurant.latitude, lng: base.restaurant.longitude }),
  };
}
