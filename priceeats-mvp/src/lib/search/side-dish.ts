import type { FoodBase } from './filter';

/** 單點小菜、湯品、配料的判斷 (規則式，資料庫沒有「主餐／配菜」欄位；不用模型) */

/** 名稱開頭就是小菜 */
const SIDE_NAME =
  /^(白飯|滷蛋|魯蛋|皮蛋|海帶|豆干|大豆干|小豆干|花干|素雞|油豆腐|魯豆腐|筍絲|燙青菜|各式小菜|小菜|青菜)/;
const SIDE_ANY = /(小黃瓜|豬耳朵|豬頭皮|豬皮|豬肺|豬心|單點)/;
const SOUP_NAME = /(湯|羹)(（[^）]*）|\([^)]*\))?$/;

/** 去掉括號備註後的名稱，例如「滷鴨蛋（2顆）」→「滷鴨蛋」 */
export function plainName(name: string): string {
  return name.replace(/[（(][^）)]*[）)]/g, '').trim();
}

/** 滷味單品：整個名稱就是這些單品 (可帶烹調前綴與數量)，「蛋炒飯」「蛋餅」不會中 */
const BRAISED_ITEM =
  /^(?:滷|魯|茶葉|鹹|皮|荷包|煎|水煮|溏心|半熟|白煮|炸|小|大|黑|特製|招牌|傳統|手工)*(?:鴨蛋|雞蛋|鵝蛋|鳥蛋|鐵蛋|蛋|豆干|海帶|木耳|豬血糕|米血糕|米血|豬血)(?:\s*[x×*]?\s*\d*\s*[顆個塊片份條串])?$/;
/** 主餐字：含這些字的名稱不會因為「泡菜」「涼拌」被當成小菜 */
const MAIN_CHAR = /(飯|麵|面|粥|鍋|堡|便當|套餐|定食|丼|餐|炒|餅|水餃|餛飩|米粉|河粉|粿條|義大利|吐司|三明治|拉麵)/;
/** 加麵／加飯／加料：加購品項 */
const ADD_ON = /^(?:追加|加購|加|多)(?:大|小)?(?:麵|飯|料|蛋|湯|菜|肉|起司|辣|蒜|醬|粉)/;
/** 白飯、麵線／冬粉單點 */
const PLAIN_STARCH = /^(?:白|米|白米|紫米|五穀|糙米)?飯$|^(?:白|紅|細|粗)?(?:麵線|冬粉)$/;
/** 一貫、單顆、一串：單件計價 */
const PER_PIECE = /(一貫|單貫|單顆|一串|單串)/;

/** 便當、早餐分類的低價品項仍可能是一餐，不套用「≤ 35 元視為單點」 */
const MEAL_CATEGORIES = new Set(['便當', '早餐']);

/** 價格不高於此值且非便當／早餐分類，預設視為單點 */
export const SIDE_PRICE_MAX = 35;

export function isSideDish(b: FoodBase): boolean {
  const { name, price } = b.food;
  const n = plainName(name);
  if (price <= SIDE_PRICE_MAX && !MEAL_CATEGORIES.has(b.categoryName)) return true;
  if (b.categoryName === '肉類') return true;
  // 開頭是小菜字眼，但整道含主餐字 (如「豆干炒肉絲飯」「海帶排骨湯麵」) 不算
  if (SIDE_NAME.test(name) && !MAIN_CHAR.test(n)) return true;
  if (SIDE_ANY.test(name)) return true;
  if (SOUP_NAME.test(name)) return true;
  if (BRAISED_ITEM.test(n)) return true;
  if (PLAIN_STARCH.test(n)) return true;
  if (ADD_ON.test(n)) return true;
  if (PER_PIECE.test(n)) return true;
  if ((n.includes('泡菜') || n.includes('涼拌')) && !MAIN_CHAR.test(n)) return true;
  return false;
}
