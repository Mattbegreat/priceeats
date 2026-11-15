import { isMultiServing } from './multi-serving';
import { isSideDish } from './side-dish';
import type { FoodBase } from './filter';
import type { FoodView, SearchParams } from '@/types';

/** 餐點頁「這家店 N 元內還有」最多列幾道 */
export const SAME_STORE_WITHIN_MAX = 5;
/** 餐點頁「多加一點預算」最多列幾道 */
export const SAME_STORE_EXTRA_MAX = 3;
/** 「多加一點預算」的加價上限 (元) */
export const SAME_STORE_EXTRA_BUDGET = 20;

export interface SameStore {
  /** 預算內 (price <= budget)，價格高到低 (最貼近預算)，最多 5 道 */
  within: FoodBase[];
  /** 超出預算但 <= 預算 + 20 元，價格低到高，最多 3 道 */
  extra: FoodBase[];
}

const byName = (a: FoodBase, b: FoodBase) => a.food.name.localeCompare(b.food.name, 'zh-Hant') || a.food.id.localeCompare(b.food.id);

/** 同一家店的其他餐點 (不含自己)；沿用搜尋的「含單點小菜／含多人份」勾選，上架中的餐點才列。 */
export function sameStoreAlternatives(index: FoodBase[], current: Pick<FoodView, 'food'>, p: Pick<SearchParams, 'budget' | 'sides' | 'multi'>): SameStore {
  const pool = index.filter((b) => {
    if (b.food.restaurant_id !== current.food.restaurant_id || b.food.id === current.food.id) return false;
    if (!b.food.is_available) return false;
    if (p.sides === false && isSideDish(b)) return false;
    if (p.multi === false && isMultiServing(b)) return false;
    return true;
  });
  const within = pool
    .filter((b) => b.food.price <= p.budget)
    .sort((a, b) => b.food.price - a.food.price || byName(a, b))
    .slice(0, SAME_STORE_WITHIN_MAX);
  const extra = pool
    .filter((b) => b.food.price > p.budget && b.food.price <= p.budget + SAME_STORE_EXTRA_BUDGET)
    .sort((a, b) => a.food.price - b.food.price || byName(a, b))
    .slice(0, SAME_STORE_EXTRA_MAX);
  return { within, extra };
}
