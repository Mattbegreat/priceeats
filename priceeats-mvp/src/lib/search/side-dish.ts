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
const PLAIN_STARCH = /^(?:白|米|白米|紫米|五穀|糙米)?飯(?:一碗|小碗|大碗)?$|^(?:白|紅|細|粗)?(?:麵線|冬粉)$/;
/** 一貫、單顆、一串：單件計價 */
const PER_PIECE = /(一貫|單貫|單顆|一串|單串)/;

/** 便當、早餐分類的低價品項仍可能是一餐，不套用「≤ 35 元視為單點」 */
const MEAL_CATEGORIES = new Set(['便當', '早餐']);
/** 飯類、麵食分類且名稱含這些主餐字時，低價也不套用「≤ 35 元視為單點」(滷肉飯 $20、烏龍麵 $25) */
const CHEAP_MAIN_CATEGORIES = new Set(['飯類', '麵食']);
const CHEAP_MAIN_CHAR = /(飯|麵|粥|米粉|冬粉|粄條|河粉|餃|丼|咖哩)/;

/** 價格不高於此值且非便當／早餐、也不是低價主餐，預設視為單點 */
export const SIDE_PRICE_MAX = 35;

/** 任何分類的單點關鍵字 (名稱含這些字且不含主餐字時) */
const SIDE_KEYWORD =
  /(小菜|花生|小魚辣椒|可樂餅|茶碗蒸|薯條|洋蔥圈|起司條|牛蒡絲|豆苗|芥藍|青菜)/;
/** 上列關鍵字旁若出現這些字，整道是主餐 (如「可樂餅咖哩飯」「青菜肉絲麵」「花生牛肉堡蔬菜鬆餅」) */
const SIDE_KEYWORD_BLOCK = /(飯|麵|粥|便當|餐|定食|丼|鍋|堡|三明治|吐司|咖哩|粉)/;
/** 燙＋菜名：燙豆芽菜、燙地瓜葉、燙青菜 */
const BLANCHED_VEG = /^燙.*(菜|葉|芽|苗|花|瓜|豆|蔬|筍|菇|藍)/;
/** 白飯含份量：白飯小份、白飯（大） */
const PLAIN_RICE = /^白飯(?:小份|中份|大份)?$/;
/** 沙拉：名稱不含 餐／飯／麵 */
const SALAD = /沙拉/;
const SALAD_BLOCK = /(餐|飯|麵)/;
/** 天婦羅與單點海鮮：名稱不含 丼／定食／飯／麵 */
const TEMPURA_SEAFOOD = /(天婦羅|柳葉魚|生蠔|干貝|草蝦|牡蠣)/;
const TEMPURA_BLOCK = /(丼|定食|飯|麵)/;

/** 小吃、海鮮、肉類分類採正面表列：名稱含這些字才算主餐，其餘視為單點 */
const POSITIVE_CATEGORIES = new Set(['小吃', '海鮮', '肉類']);
const POSITIVE_MAIN =
  /(飯|麵|便當|餐盒|套餐|定食|丼|粥|鍋|堡|三明治|吐司|蛋餅|鬆餅|披薩|咖哩|拉麵|烏龍|米粉|冬粉|粄條|河粉|餛飩|盛合|三味盛|三鮮)/;
/** 水餃／鍋貼／煎餃：括號數量 ≥ 8 或未標數量才算主餐 */
const DUMPLING = /(水餃|鍋貼|煎餃)/;
export const DUMPLING_MIN_COUNT = 8;

/** 名稱內標的數量 (如「（10個）」「8顆」)；沒標回傳 null */
export function pieceCount(name: string): number | null {
  const m = name.match(/(\d+)\s*(?:顆|個|粒|入|隻|件|枚|只)/);
  return m ? Number(m[1]) : null;
}

/** 小吃／海鮮／肉類：是否為主餐 (正面表列) */
function isPositiveMain(name: string): boolean {
  // 鍋貼含「鍋」，數量規則要先判斷
  if (DUMPLING.test(name)) {
    const c = pieceCount(name);
    return c === null || c >= DUMPLING_MIN_COUNT;
  }
  return POSITIVE_MAIN.test(name);
}

export function isSideDish(b: FoodBase): boolean {
  const { name, price } = b.food;
  const n = plainName(name);
  const cheapMain = CHEAP_MAIN_CATEGORIES.has(b.categoryName) && CHEAP_MAIN_CHAR.test(n);
  if (price <= SIDE_PRICE_MAX && !MEAL_CATEGORIES.has(b.categoryName) && !cheapMain) return true;
  // 開頭是小菜字眼，但整道含主餐字 (如「豆干炒肉絲飯」「海帶排骨湯麵」) 不算
  if (SIDE_NAME.test(name) && !MAIN_CHAR.test(n)) return true;
  if (SIDE_ANY.test(name)) return true;
  if (SOUP_NAME.test(name)) return true;
  if (BRAISED_ITEM.test(n)) return true;
  if (PLAIN_STARCH.test(n)) return true;
  if (ADD_ON.test(n)) return true;
  if (PER_PIECE.test(n)) return true;
  if ((n.includes('泡菜') || n.includes('涼拌')) && !MAIN_CHAR.test(n)) return true;
  if (PLAIN_RICE.test(n)) return true;
  if (BLANCHED_VEG.test(n) && !SIDE_KEYWORD_BLOCK.test(n)) return true;
  if (SIDE_KEYWORD.test(n) && !SIDE_KEYWORD_BLOCK.test(n)) return true;
  if (SALAD.test(n) && !SALAD_BLOCK.test(n)) return true;
  if (TEMPURA_SEAFOOD.test(n) && !TEMPURA_BLOCK.test(n)) return true;
  // 小吃、海鮮、肉類：正面表列，沒有主餐字就是單點
  if (POSITIVE_CATEGORIES.has(b.categoryName)) return !isPositiveMain(name);
  return false;
}
