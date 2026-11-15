import type { FoodView } from '@/types';

/** 結果以店分組後的一張卡 */
export interface StoreGroup {
  restaurantId: string;
  /** 該店 (組內第一道) 的餐廳與距離 */
  head: FoodView;
  /** 該店符合條件的全部餐點，依「最貼近預算」排序 (價格高到低→名稱→id) */
  items: FoodView[];
}

/** 預設卡片上顯示的餐點數 */
export const GROUP_PREVIEW = 3;

/**
 * 把已排序的搜尋結果以店分組：店的順序＝該店第一道餐點在原排序中的位置 (沿用使用者選的排序)；
 * 店內餐點一律依最貼近預算排列 (價格高到低，同價依名稱、id 穩定)。
 */
export function groupByStore(sorted: FoodView[]): StoreGroup[] {
  const order: string[] = [];
  const m = new Map<string, FoodView[]>();
  for (const v of sorted) {
    const id = v.restaurant.id;
    const arr = m.get(id);
    if (arr) arr.push(v);
    else {
      m.set(id, [v]);
      order.push(id);
    }
  }
  return order.map((id) => {
    const items = (m.get(id) as FoodView[])
      .slice()
      .sort((a, b) => b.food.price - a.food.price || a.food.name.localeCompare(b.food.name, 'zh-Hant') || a.food.id.localeCompare(b.food.id));
    return { restaurantId: id, head: items[0], items };
  });
}
