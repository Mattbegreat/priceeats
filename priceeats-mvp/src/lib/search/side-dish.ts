import type { FoodBase } from './filter';

/** 單點小菜、湯品、配料的名稱特徵 (規則式判斷，資料庫沒有「主餐／配菜」欄位) */
const SIDE_NAME =
  /^(白飯|滷蛋|魯蛋|皮蛋|海帶|豆干|大豆干|小豆干|花干|素雞|油豆腐|魯豆腐|筍絲|燙青菜|各式小菜|小菜|青菜)/;
const SIDE_ANY = /(小黃瓜|豬耳朵|豬頭皮|豬皮|豬肺|豬心|單點)/;
const SOUP_NAME = /(湯|羹)(（[^）]*）|\([^)]*\))?$/;

/** 低於此價格視為配料；肉類單點、湯、小菜預設不當成「一餐」 */
export const SIDE_PRICE_BELOW = 30;

export function isSideDish(b: FoodBase): boolean {
  const { name, price } = b.food;
  if (price < SIDE_PRICE_BELOW) return true;
  if (b.categoryName === '肉類') return true;
  if (SIDE_NAME.test(name)) return true;
  if (SIDE_ANY.test(name)) return true;
  if (SOUP_NAME.test(name)) return true;
  return false;
}
