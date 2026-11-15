import type { Category, Dataset, Food, FoodTag, MenuImage, PriceVerification, Restaurant } from '@/types';
import type { ReportInput } from '@/lib/pricing/report';
import { boundingBox } from '@/lib/geo/bbox';
import { haversineM } from '@/lib/geo/haversine';
import { newId, saveLocalSubmission, toPendingVerification } from './local';
import type { LoadArea, MenuSubmissionInput, Repository, StoredMenuSubmission } from './types';

/**
 * 以 Supabase PostgREST (REST API) 實作，不額外引入 @supabase/supabase-js。
 * 只使用 anon key；權限完全由資料庫 RLS 決定 (見 supabase/migrations/0001_init.sql)。
 */
const PAGE = 1000;
/** `in.(…)` 每批 id 上限，避免網址過長 */
const IN_BATCH = 100;
/** 同時進行的批次請求數上限 */
const CONCURRENCY = 6;
/** 快取 key 的中心座標四捨五入位數 (3 位約 110 公尺) */
const CENTER_DIGITS = 3;
/** 四捨五入造成的中心位移最多約 110 公尺，查詢半徑多加 150 公尺補回 */
const ROUND_PAD_M = 150;

interface CacheEntry {
  key: string;
  center: { lat: number; lng: number };
  /** 實際查詢半徑 (公尺，含補償) */
  radiusM: number;
  promise: Promise<Dataset>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** 限制同時進行的請求數，結果依輸入順序回傳 */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}`, ...extra };
  }

  /** PostgREST 每次最多回 1000 筆（Supabase max-rows），所以先取總數再平行分頁抓完 */
  private async get<T>(table: string, query = 'select=*'): Promise<T[]> {
    const base = `${this.url.replace(/\/$/, '')}/rest/v1/${table}?${query}`;
    const page = async (from: number, count = false) => {
      const res = await this.fetchImpl(`${base}&limit=${PAGE}&offset=${from}`, {
        headers: this.headers(count ? { Prefer: 'count=exact' } : {}),
      });
      if (!res.ok) throw new Error(`Supabase 讀取 ${table} 失敗 (${res.status})`);
      return { rows: (await res.json()) as T[], range: res.headers?.get?.('content-range') ?? null };
    };
    const first = await page(0, true);
    const total = Number(first.range?.split('/')[1]);
    if (!Number.isFinite(total) || total <= first.rows.length) return first.rows;
    const offsets: number[] = [];
    for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
    const rest = await Promise.all(offsets.map((o) => page(o)));
    return first.rows.concat(...rest.map((r) => r.rows));
  }

  private readonly cache: CacheEntry[] = [];

  /**
   * 正式模式：只載入 is_test_data = false 的店，測試資料不會出現。
   * 有 area：只查中心附近的店與其餐點，已載入且涵蓋該範圍時直接用記憶體快取；沒有 area：整張表 (相容舊行為)。
   */
  async load(_today?: Date, area?: LoadArea): Promise<Dataset> {
    if (!area) return this.loadAll();
    const center = {
      lat: Number(area.center.lat.toFixed(CENTER_DIGITS)),
      lng: Number(area.center.lng.toFixed(CENTER_DIGITS)),
    };
    const radiusM = Math.round(area.radiusM);
    // 已快取的範圍涵蓋這次要求 (同範圍、縮小、或平移後仍在內) → 不再下載
    const hit = this.cache.find((e) => haversineM(e.center, area.center) + radiusM <= e.radiusM);
    if (hit) return hit.promise;
    const entry: CacheEntry = {
      key: `${center.lat},${center.lng},${radiusM}`,
      center,
      radiusM: radiusM + ROUND_PAD_M,
      promise: this.loadNearby(center, radiusM + ROUND_PAD_M),
    };
    this.cache.push(entry);
    // 失敗不留快取，重試時會重新下載
    entry.promise.catch(() => {
      const i = this.cache.indexOf(entry);
      if (i >= 0) this.cache.splice(i, 1);
    });
    return entry.promise;
  }

  private async loadNearby(center: { lat: number; lng: number }, radiusM: number): Promise<Dataset> {
    const box = boundingBox(center, radiusM / 1000);
    const q =
      `select=*&is_test_data=eq.false` +
      `&latitude=gte.${box.minLat}&latitude=lte.${box.maxLat}` +
      `&longitude=gte.${box.minLng}&longitude=lte.${box.maxLng}`;
    const [categories, boxed] = await Promise.all([
      this.get<Category>('categories'),
      this.get<Restaurant>('restaurants', q),
    ]);
    // 方框比圓大 (四個角落)，用 haversine 精確過濾
    const restaurants = boxed.filter((r) => haversineM(center, { lat: r.latitude, lng: r.longitude }) <= radiusM);
    const restaurantIds = restaurants.map((r) => r.id);
    const byRestaurant = (table: string) =>
      pool(chunk(restaurantIds, IN_BATCH), CONCURRENCY, (ids) =>
        this.get<{ restaurant_id: string }>(table, `select=*&restaurant_id=in.(${ids.join(',')})`),
      ).then((r) => r.flat());
    const [foods, menuImages] = await Promise.all([
      byRestaurant('foods') as Promise<Food[]>,
      (byRestaurant('menu_images') as Promise<MenuImage[]>).catch(() => [] as MenuImage[]),
    ]);
    const foodIds = foods.map((f) => f.id);
    const byFood = <T>(table: string) =>
      pool(chunk(foodIds, IN_BATCH), CONCURRENCY, (ids) => this.get<T>(table, `select=*&food_id=in.(${ids.join(',')})`)).then((r) =>
        r.flat(),
      );
    const [foodTags, verifications] = await Promise.all([byFood<FoodTag>('food_tags'), byFood<PriceVerification>('price_verifications')]);
    return { categories, restaurants, foods, foodTags, verifications, menuImages };
  }

  private async loadAll(): Promise<Dataset> {
    const [categories, restaurants, allFoods, allTags, allVerifications, allMenuImages] = await Promise.all([
      this.get<Category>('categories'),
      this.get<Restaurant>('restaurants', 'select=*&is_test_data=eq.false'),
      this.get<Food>('foods'),
      this.get<FoodTag>('food_tags'),
      this.get<PriceVerification>('price_verifications'),
      this.get<MenuImage>('menu_images').catch(() => [] as MenuImage[]),
    ]);
    const restaurantIds = new Set(restaurants.map((r) => r.id));
    const foods = allFoods.filter((f) => restaurantIds.has(f.restaurant_id));
    const foodIds = new Set(foods.map((f) => f.id));
    return {
      categories,
      restaurants,
      foods,
      foodTags: allTags.filter((t) => foodIds.has(t.food_id)),
      verifications: allVerifications.filter((v) => foodIds.has(v.food_id)),
      menuImages: allMenuImages.filter((m) => restaurantIds.has(m.restaurant_id)),
    };
  }

  async submitReport(input: ReportInput, today: Date): Promise<PriceVerification> {
    const v = toPendingVerification(input, today);
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/price_verifications`, {
      method: 'POST',
      // anon 沒有 SELECT pending 的權限，所以不要求回傳內容
      headers: this.headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({
        id: v.id || newId(),
        food_id: v.food_id,
        reported_price: v.reported_price,
        report_type: v.report_type,
        note: v.note,
        source_type: v.source_type,
        verification_status: 'pending',
        verified_at: v.verified_at,
        confidence_score: v.confidence_score,
      }),
    });
    if (!res.ok) throw new Error(`回報送出失敗 (${res.status})`);
    // 價格紀錄已變動，清掉快取讓下一次載入拿到最新資料
    this.cache.length = 0;
    return v;
  }

  /** 第一階段：圖片尚未接 Supabase Storage，菜單投稿先存本機待審草稿 */
  async submitMenu(
    input: MenuSubmissionInput,
    ocrStatus: StoredMenuSubmission['ocr_status'],
    today: Date,
  ): Promise<StoredMenuSubmission> {
    return saveLocalSubmission(input, ocrStatus, today);
  }
}
