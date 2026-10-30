import type { Category, Dataset, Food, FoodTag, MenuImage, PriceVerification, Restaurant } from '@/types';
import type { ReportInput } from '@/lib/pricing/report';
import { newId, saveLocalSubmission, toPendingVerification } from './local';
import type { MenuSubmissionInput, Repository, StoredMenuSubmission } from './types';

/**
 * 以 Supabase PostgREST (REST API) 實作，不額外引入 @supabase/supabase-js。
 * 只使用 anon key；權限完全由資料庫 RLS 決定 (見 supabase/migrations/0001_init.sql)。
 */
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

  private async get<T>(table: string, query = 'select=*'): Promise<T[]> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, '')}/rest/v1/${table}?${query}&limit=10000`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Supabase 讀取 ${table} 失敗 (${res.status})`);
    return (await res.json()) as T[];
  }

  /** 正式模式：只載入 is_test_data = false 的店，其餘資料表依店家／餐點一併過濾，測試資料不會出現 */
  async load(): Promise<Dataset> {
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
